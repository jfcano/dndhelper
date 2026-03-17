from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import hashlib
import json
from typing import Callable

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from tqdm import tqdm

from backend.app.config import get_settings
from backend.app.vector_store import get_vector_store

# Tamaño de lote para indexar con barra de progreso (embeddings en CPU son lentos)
_INGEST_BATCH_SIZE = 32


@dataclass(frozen=True)
class IngestResult:
    pdf_path: str
    pdf_sha256: str
    chunks_indexed: int
    collection: str
    manifest_path: str


def _sanitize_utf8(s: str) -> str:
    """Normaliza texto para almacenamiento/embeddings.

    - Reemplaza surrogates y otros caracteres no encodables en UTF-8.
    - Elimina bytes NUL ('\\x00'), que Postgres no permite en campos TEXT.
    """
    s = s.encode("utf-8", errors="replace").decode("utf-8")
    return s.replace("\x00", "")


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _manifest_path(project_root: Path) -> Path:
    # Archivo local para evitar re-ingestas innecesarias. No está relacionado con el vector store.
    storage_dir = project_root / "backend" / "storage"
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir / "ingest_manifest.json"


def _load_manifest(project_root: Path) -> dict:
    p = _manifest_path(project_root)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def _save_manifest(project_root: Path, manifest: dict) -> None:
    p = _manifest_path(project_root)
    p.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def ingest_pdf(
    pdf_path: str,
    *,
    force: bool = False,
    show_progress: bool = True,
    progress_callback: Callable[[str, int, int], None] | None = None,
) -> IngestResult:
    """
    Indexa un PDF en Postgres (pgvector) usando LangChain.
    show_progress: si True, usa tqdm en consola para la fase de indexación.
    progress_callback(phase, current, total): opcional; phase in ("load", "split", "index").
    """
    settings = get_settings()

    pdf = Path(pdf_path)
    if not pdf.exists():
        raise FileNotFoundError(f"No existe el PDF: {pdf}")

    pdf_sha = _sha256_file(pdf)
    manifest = _load_manifest(settings.project_root)
    key = f"{settings.default_collection}:{str(pdf.resolve())}"

    if not force and manifest.get(key, {}).get("pdf_sha256") == pdf_sha:
        mp = _manifest_path(settings.project_root)
        return IngestResult(
            pdf_path=str(pdf),
            pdf_sha256=pdf_sha,
            chunks_indexed=0,
            collection=settings.default_collection,
            manifest_path=str(mp),
        )

    def _report(phase: str, current: int, total: int) -> None:
        if progress_callback:
            progress_callback(phase, current, total)

    # Fase 1: cargar PDF
    if show_progress:
        tqdm.write(f"Cargando PDF: {pdf.name}")
    loader = PyPDFLoader(str(pdf))
    docs = loader.load()
    _report("load", len(docs), len(docs))
    if show_progress:
        tqdm.write(f"  Páginas cargadas: {len(docs)}")

    # Fase 2: dividir en chunks
    if show_progress:
        tqdm.write("Dividiendo en chunks...")
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    chunks = splitter.split_documents(docs)
    # Excluir chunks vacíos y normalizar page_content (UTF-8 válido, sin surrogates)
    valid = []
    for d in chunks:
        raw = getattr(d, "page_content", None)
        if raw is None:
            continue
        text = str(raw).strip()
        if not text:
            continue
        text = _sanitize_utf8(text)
        d.page_content = text
        valid.append(d)
    chunks = valid
    _report("split", len(chunks), len(chunks))
    if show_progress:
        tqdm.write(f"  Chunks generados: {len(chunks)}")

    # Metadatos mínimos útiles para citar origen
    for d in chunks:
        d.metadata = d.metadata or {}
        d.metadata.setdefault("source", str(pdf))

    vs = get_vector_store()
    # Si re-ingestamos, limpiamos la colección para no duplicar
    if force or manifest.get(key):
        try:
            vs.delete_collection()
        except Exception:
            pass
        vs = get_vector_store()

    # Fase 3: indexar en lotes con barra de progreso (lo más lento en CPU)
    if show_progress:
        tqdm.write("Indexando embeddings (puede tardar varios minutos en CPU)...")
    batch_size = _INGEST_BATCH_SIZE
    for start in tqdm(
        range(0, len(chunks), batch_size),
        desc="Indexando chunks",
        total=(len(chunks) + batch_size - 1) // batch_size,
        unit="lote",
        disable=not show_progress,
    ):
        batch = chunks[start : start + batch_size]
        vs.add_documents(batch)
        _report("index", min(start + len(batch), len(chunks)), len(chunks))

    manifest[key] = {
        "pdf_sha256": pdf_sha,
        "pdf_path": str(pdf.resolve()),
        "collection": settings.default_collection,
        "chunks": len(chunks),
    }
    _save_manifest(settings.project_root, manifest)
    mp = _manifest_path(settings.project_root)

    return IngestResult(
        pdf_path=str(pdf),
        pdf_sha256=pdf_sha,
        chunks_indexed=len(chunks),
        collection=settings.default_collection,
        manifest_path=str(mp),
    )


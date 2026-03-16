from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import hashlib
import json

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from backend.app.config import get_settings
from backend.app.vector_store import get_vector_store


@dataclass(frozen=True)
class IngestResult:
    pdf_path: str
    pdf_sha256: str
    chunks_indexed: int
    collection: str
    persist_dir: str


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def _manifest_path(persist_dir: Path) -> Path:
    return persist_dir / "ingest_manifest.json"


def _load_manifest(persist_dir: Path) -> dict:
    p = _manifest_path(persist_dir)
    if not p.exists():
        return {}
    return json.loads(p.read_text(encoding="utf-8"))


def _save_manifest(persist_dir: Path, manifest: dict) -> None:
    p = _manifest_path(persist_dir)
    p.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def ingest_pdf(pdf_path: str, *, force: bool = False) -> IngestResult:
    settings = get_settings()
    persist_dir = settings.chroma_persist_dir
    persist_dir.mkdir(parents=True, exist_ok=True)

    pdf = Path(pdf_path)
    if not pdf.exists():
        raise FileNotFoundError(f"No existe el PDF: {pdf}")

    pdf_sha = _sha256_file(pdf)
    manifest = _load_manifest(persist_dir)
    key = f"{settings.default_collection}:{str(pdf.resolve())}"

    if not force and manifest.get(key, {}).get("pdf_sha256") == pdf_sha:
        return IngestResult(
            pdf_path=str(pdf),
            pdf_sha256=pdf_sha,
            chunks_indexed=0,
            collection=settings.default_collection,
            persist_dir=str(persist_dir),
        )

    loader = PyPDFLoader(str(pdf))
    docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
    )
    chunks = splitter.split_documents(docs)

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
            # MVP: si no existe aún, seguimos
            pass
        vs = get_vector_store()

    vs.add_documents(chunks)
    # Algunas versiones persisten automáticamente; mantener llamada segura
    persist = getattr(vs, "persist", None)
    if callable(persist):
        persist()

    manifest[key] = {
        "pdf_sha256": pdf_sha,
        "pdf_path": str(pdf.resolve()),
        "collection": settings.default_collection,
        "chunks": len(chunks),
    }
    _save_manifest(persist_dir, manifest)

    return IngestResult(
        pdf_path=str(pdf),
        pdf_sha256=pdf_sha,
        chunks_indexed=len(chunks),
        collection=settings.default_collection,
        persist_dir=str(persist_dir),
    )


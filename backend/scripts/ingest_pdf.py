"""
Script de ingesta: indexa documentos (PDF, TXT, DOCX) en Postgres (pgvector).

- Sin argumentos: busca .pdf, .txt y .docx en backend/data de forma recursiva.
- Con --pdf RUTA: indexa solo ese fichero.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from uuid import UUID

from backend.app.config import get_settings
from backend.app.ingest import ingest_pdf as run_ingest_pdf
from backend.app.rag_collection import rag_manuals_collection_for_owner


def main() -> None:
    settings = get_settings()
    _exts = (".pdf", ".txt", ".docx")
    parser = argparse.ArgumentParser(
        description="Ingesta documentos (PDF, TXT, DOCX) en Postgres (pgvector). Sin --pdf se indexan coincidencias en backend/data (recursivo)."
    )
    parser.add_argument(
        "--pdf",
        metavar="RUTA",
        help="Ruta a un único documento. Si no se indica, se buscan .pdf, .txt y .docx bajo backend/data.",
    )
    parser.add_argument("--force", action="store_true", help="Recrear el índice aunque ya exista.")
    parser.add_argument("--no-progress", action="store_true", help="Ocultar barra de progreso.")
    parser.add_argument(
        "--collection",
        metavar="NOMBRE",
        default=None,
        help=f"Nombre de colección PGVector (por defecto: RAG_COLLECTION / {settings.default_collection!r}).",
    )
    parser.add_argument(
        "--owner-id",
        metavar="UUID",
        default=None,
        help="UUID del usuario (misma colección que la app web: rag_u_<hex>). Si se indica, tiene prioridad sobre --collection.",
    )
    args = parser.parse_args()
    if args.owner_id:
        collection_name = rag_manuals_collection_for_owner(UUID(str(args.owner_id).strip()))
    else:
        collection_name = args.collection or settings.default_collection

    if args.pdf:
        paths = [Path(args.pdf)]
    else:
        data_dir = settings.data_dir
        if not data_dir.is_dir():
            parser.error(f"No existe la carpeta de datos: {data_dir}")
        seen: set[Path] = set()
        paths = []
        for pat in ("*.pdf", "*.txt", "*.docx"):
            for p in data_dir.rglob(pat):
                rp = p.resolve()
                if rp not in seen:
                    seen.add(rp)
                    paths.append(p)
        paths.sort(key=lambda x: str(x))
        if not paths:
            parser.error(f"No hay ningún .pdf/.txt/.docx en {data_dir} (búsqueda recursiva).")
        print(f"Encontrados {len(paths)} documento(s) en {data_dir}")

    for i, pdf_path in enumerate(paths):
        if not pdf_path.exists():
            print(f"[SKIP] No existe: {pdf_path}")
            continue
        if pdf_path.suffix.lower() not in _exts:
            print(f"[SKIP] Extensión no soportada: {pdf_path}")
            continue
        if len(paths) > 1:
            print(f"\n--- Documento {i + 1}/{len(paths)}: {pdf_path.name} ---")
        result = run_ingest_pdf(
            str(pdf_path),
            collection_name=collection_name,
            force=args.force,
            show_progress=not args.no_progress,
        )
        if result.chunks_indexed == 0 and not args.force:
            print("Índice ya existente (mismo contenido). No se recalculan embeddings.")
        else:
            print(f"Chunks indexados: {result.chunks_indexed}")
        if len(paths) == 1:
            print(f"Colección: {result.collection}")
            print(f"Manifest: {result.manifest_path}")

    if len(paths) > 1:
        print("\nListo.")


if __name__ == "__main__":
    main()

"""
Ingesta uno o más documentos (PDF, TXT, DOCX) en la misma colección de Postgres (pgvector).
Cada fichero se añade al índice sin borrar los ya indexados (salvo --force donde aplique).
"""
from __future__ import annotations

import argparse
from pathlib import Path
from uuid import UUID

from backend.app.config import get_settings
from backend.app.ingest import ingest_pdf
from backend.app.rag_collection import rag_manuals_collection_for_owner


def main() -> None:
    settings = get_settings()
    _exts = (".pdf", ".txt", ".docx")
    parser = argparse.ArgumentParser(
        description="Ingesta uno o más documentos (PDF, TXT, DOCX) en Postgres (pgvector). Los nuevos se añaden al índice existente."
    )
    parser.add_argument(
        "--pdf",
        action="append",
        dest="pdfs",
        metavar="RUTA",
        help="Ruta a un documento. Puedes repetir para varios.",
    )
    parser.add_argument(
        "--dir",
        metavar="CARPETA",
        help="Carpeta con documentos; se indexan .pdf, .txt y .docx de forma recursiva.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Recrear el índice de cada PDF aunque ya exista (¡borra toda la colección y re-ingesta solo los indicados!).",
    )
    parser.add_argument(
        "--no-progress",
        action="store_true",
        help="Ocultar barra de progreso.",
    )
    parser.add_argument(
        "--collection",
        metavar="NOMBRE",
        default=None,
        help=f"Colección PGVector compartida por estos PDFs (por defecto: {settings.default_collection!r}).",
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

    paths: list[Path] = []
    if args.pdfs:
        for p in args.pdfs:
            paths.append(Path(p))
    if args.dir:
        folder = Path(args.dir)
        if not folder.is_dir():
            parser.error(f"No es una carpeta: {folder}")
        seen: set[Path] = set()
        for pat in ("*.pdf", "*.txt", "*.docx"):
            for p in folder.rglob(pat):
                rp = p.resolve()
                if rp not in seen:
                    seen.add(rp)
                    paths.append(p)
        paths = sorted(paths, key=lambda x: str(x))

    if not paths:
        parser.error("Indica al menos un PDF con --pdf RUTA o una carpeta con --dir CARPETA.")

    for i, pdf_path in enumerate(paths):
        if not pdf_path.exists():
            print(f"[SKIP] No existe: {pdf_path}")
            continue
        if pdf_path.suffix.lower() not in _exts:
            print(f"[SKIP] Extensión no soportada: {pdf_path}")
            continue
        print(f"\n--- Documento {i + 1}/{len(paths)}: {pdf_path.name} ---")
        result = ingest_pdf(
            str(pdf_path),
            collection_name=collection_name,
            force=args.force,
            show_progress=not args.no_progress,
        )
        if result.chunks_indexed == 0 and not args.force:
            print("  Ya indexado (mismo contenido). Sin cambios.")
        else:
            print(f"  Chunks indexados: {result.chunks_indexed}")
    print("\nListo.")


if __name__ == "__main__":
    main()

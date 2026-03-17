"""
Ingesta uno o más PDFs en la misma colección de Postgres (pgvector).
Cada PDF se añade al índice sin borrar los ya indexados (a menos que uses --force en uno ya ingerido).
"""
from __future__ import annotations

import argparse
from pathlib import Path

from backend.app.ingest import ingest_pdf


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingesta uno o más PDFs en Postgres (pgvector). Los nuevos se añaden al índice existente."
    )
    parser.add_argument(
        "--pdf",
        action="append",
        dest="pdfs",
        metavar="RUTA",
        help="Ruta a un PDF. Puedes repetir para varios (ej.: --pdf a.pdf --pdf b.pdf).",
    )
    parser.add_argument(
        "--dir",
        metavar="CARPETA",
        help="Carpeta con PDFs; se indexan todos los .pdf de forma recursiva.",
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
    args = parser.parse_args()

    paths: list[Path] = []
    if args.pdfs:
        for p in args.pdfs:
            paths.append(Path(p))
    if args.dir:
        folder = Path(args.dir)
        if not folder.is_dir():
            parser.error(f"No es una carpeta: {folder}")
        paths.extend(sorted(folder.rglob("*.pdf")))

    if not paths:
        parser.error("Indica al menos un PDF con --pdf RUTA o una carpeta con --dir CARPETA.")

    for i, pdf_path in enumerate(paths):
        if not pdf_path.exists():
            print(f"[SKIP] No existe: {pdf_path}")
            continue
        if not pdf_path.suffix.lower() == ".pdf":
            print(f"[SKIP] No es PDF: {pdf_path}")
            continue
        print(f"\n--- PDF {i + 1}/{len(paths)}: {pdf_path.name} ---")
        result = ingest_pdf(
            str(pdf_path),
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

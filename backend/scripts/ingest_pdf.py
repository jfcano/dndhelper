"""
Script de ingesta: indexa PDFs en Postgres (pgvector).

- Sin argumentos: busca todos los .pdf en backend/data de forma recursiva y los indexa.
- Con --pdf RUTA: indexa solo ese PDF.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from backend.app.config import get_settings
from backend.app.ingest import ingest_pdf as run_ingest_pdf


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(
        description="Ingesta PDFs en Postgres (pgvector). Sin --pdf se indexan todos los PDFs en backend/data (recursivo)."
    )
    parser.add_argument(
        "--pdf",
        metavar="RUTA",
        help="Ruta a un único PDF. Si no se indica, se usan todos los .pdf bajo backend/data.",
    )
    parser.add_argument("--force", action="store_true", help="Recrear el índice aunque ya exista.")
    parser.add_argument("--no-progress", action="store_true", help="Ocultar barra de progreso.")
    args = parser.parse_args()

    if args.pdf:
        paths = [Path(args.pdf)]
    else:
        data_dir = settings.data_dir
        if not data_dir.is_dir():
            parser.error(f"No existe la carpeta de datos: {data_dir}")
        paths = sorted(data_dir.rglob("*.pdf"))
        if not paths:
            parser.error(f"No hay ningún PDF en {data_dir} (búsqueda recursiva).")
        print(f"Encontrados {len(paths)} PDF(s) en {data_dir}")

    for i, pdf_path in enumerate(paths):
        if not pdf_path.exists():
            print(f"[SKIP] No existe: {pdf_path}")
            continue
        if pdf_path.suffix.lower() != ".pdf":
            print(f"[SKIP] No es PDF: {pdf_path}")
            continue
        if len(paths) > 1:
            print(f"\n--- PDF {i + 1}/{len(paths)}: {pdf_path.name} ---")
        result = run_ingest_pdf(
            str(pdf_path),
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

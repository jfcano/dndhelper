from __future__ import annotations

import argparse

from backend.app.ingest import ingest_pdf


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingesta un PDF en Chroma (persistente).")
    parser.add_argument("--pdf", required=True, help="Ruta al PDF a indexar.")
    parser.add_argument("--force", action="store_true", help="Recrear el índice aunque ya exista.")
    parser.add_argument("--no-progress", action="store_true", help="Ocultar barra de progreso.")
    args = parser.parse_args()

    result = ingest_pdf(
        args.pdf,
        force=args.force,
        show_progress=not args.no_progress,
    )
    if result.chunks_indexed == 0 and not args.force:
        print("Índice ya existente (mismo PDF). No se recalculan embeddings.")
    else:
        print(f"Chunks indexados: {result.chunks_indexed}")
    print(f"Colección: {result.collection}")
    print(f"Persist dir: {result.persist_dir}")


if __name__ == "__main__":
    main()


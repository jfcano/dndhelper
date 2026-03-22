"""Probe de salud para el worker de ingesta: conexión a PostgreSQL."""
from __future__ import annotations

import sys

from sqlalchemy import text

from backend.app.db import get_engine


def main() -> None:
    try:
        eng = get_engine()
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        print(f"health_ingest: {e}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()

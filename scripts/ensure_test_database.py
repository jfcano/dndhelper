#!/usr/bin/env python3
"""Crea la base de datos de pytest si no existe (útil en Docker Compose / CI)."""
from __future__ import annotations

import os
import re
import sys
from urllib.parse import urlparse, urlunparse

from sqlalchemy import create_engine, text


def main() -> int:
    url = os.environ.get("POSTGRES_TEST_URL")
    if not url:
        print("ensure_test_database: falta POSTGRES_TEST_URL", file=sys.stderr)
        return 1

    u = urlparse(url)
    dbname = (u.path or "/").strip("/")
    if not dbname:
        print("ensure_test_database: POSTGRES_TEST_URL sin nombre de base de datos", file=sys.stderr)
        return 1
    if not re.match(r"^[a-zA-Z0-9_]+$", dbname):
        print("ensure_test_database: nombre de base no permitido", file=sys.stderr)
        return 1

    admin = u._replace(path="/postgres")
    admin_url = urlunparse(admin)

    engine = create_engine(admin_url, isolation_level="AUTOCOMMIT", pool_pre_ping=True, connect_args={"connect_timeout": 10})

    with engine.connect() as conn:
        exists = conn.execute(text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": dbname}).scalar()
        if exists:
            print(f"ensure_test_database: ya existe «{dbname}»")
            return 0
        conn.execute(text(f'CREATE DATABASE "{dbname}"'))
        print(f"ensure_test_database: creada «{dbname}»")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

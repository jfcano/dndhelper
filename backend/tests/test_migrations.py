from __future__ import annotations

import os

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def test_alembic_upgrade_creates_core_tables(postgres_test_url):
    # Alembic lee POSTGRES_URL desde el entorno (ver alembic/env.py)
    old = os.environ.get("POSTGRES_URL")
    os.environ["POSTGRES_URL"] = postgres_test_url
    try:
        engine = create_engine(postgres_test_url, pool_pre_ping=True, connect_args={"connect_timeout": 5})
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS sessions CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS arcs CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS campaigns CASCADE"))
            conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))

        cfg = Config("alembic.ini")
        command.upgrade(cfg, "head")

        insp = inspect(engine)
        names = set(insp.get_table_names())
        assert "campaigns" in names
        assert "arcs" in names
        assert "sessions" in names

        cols = {c["name"] for c in insp.get_columns("campaigns")}
        assert "owner_id" in cols
    finally:
        if old is None:
            os.environ.pop("POSTGRES_URL", None)
        else:
            os.environ["POSTGRES_URL"] = old


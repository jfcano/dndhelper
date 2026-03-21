from __future__ import annotations

import os
from pathlib import Path
from typing import Generator

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from dotenv import load_dotenv


@pytest.fixture(scope="session", autouse=True)
def _setup_test_db() -> Generator[None, None, None]:
    """
    Configura la BD de tests y aplica Alembic una vez por sesión.

    Requisitos:
    - Debe existir `POSTGRES_TEST_URL` (ver scripts/test.ps1/test.sh).
    """
    project_root = Path(__file__).resolve().parents[2]

    # Cargamos el .env del repo para obtener POSTGRES_TEST_URL si no está exportado.
    load_dotenv(project_root / ".env")

    postgres_test_url = os.getenv("POSTGRES_TEST_URL")
    if not postgres_test_url:
        pytest.skip("Falta POSTGRES_TEST_URL (ejecuta scripts/test.*).")

    # El backend usa POSTGRES_URL (no POSTGRES_TEST_URL).
    # Forzamos que apunte al DB aislado de tests.
    os.environ["POSTGRES_URL"] = postgres_test_url

    # Asegura schema actualizado.
    alembic_cfg = Config(str(project_root / "alembic.ini"))

    # Para tests robustos contra estado parcial de la BD:
    # limpiamos tablas base y reiniciamos el historial de Alembic.
    engine = create_engine(
        os.environ["POSTGRES_URL"],
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS sessions CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS campaigns CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS worlds CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS owner_settings CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS ingest_jobs CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS arcs CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))

    command.upgrade(alembic_cfg, "head")

    yield


@pytest.fixture(scope="function", autouse=True)
def _clean_tables() -> Generator[None, None, None]:
    """
    Limpia tablas del dominio para evitar interferencias entre tests.
    """
    postgres_url = os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_TEST_URL")
    if not postgres_url:
        yield
        return

    engine = create_engine(
        postgres_url,
        pool_pre_ping=True,
        connect_args={"connect_timeout": 5},
    )
    with engine.begin() as conn:
        # Orden: sesiones -> campaigns -> worlds
        conn.execute(
            text(
                "DO $$ BEGIN IF to_regclass('public.sessions') IS NOT NULL THEN "
                "TRUNCATE TABLE sessions RESTART IDENTITY CASCADE; END IF; END $$;"
            )
        )
        conn.execute(
            text(
                "DO $$ BEGIN IF to_regclass('public.campaigns') IS NOT NULL THEN "
                "TRUNCATE TABLE campaigns RESTART IDENTITY CASCADE; END IF; END $$;"
            )
        )
        conn.execute(
            text(
                "DO $$ BEGIN IF to_regclass('public.worlds') IS NOT NULL THEN "
                "TRUNCATE TABLE worlds RESTART IDENTITY CASCADE; END IF; END $$;"
            )
        )
        conn.execute(
            text(
                "DO $$ BEGIN IF to_regclass('public.owner_settings') IS NOT NULL THEN "
                "TRUNCATE TABLE owner_settings; END IF; END $$;"
            )
        )
        conn.execute(
            text(
                "DO $$ BEGIN IF to_regclass('public.ingest_jobs') IS NOT NULL THEN "
                "TRUNCATE TABLE ingest_jobs; END IF; END $$;"
            )
        )
    yield


@pytest.fixture()
def client() -> TestClient:
    from backend.app.main import app

    return TestClient(app)


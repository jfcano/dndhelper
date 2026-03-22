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

# El lifespan de FastAPI no debe lanzar el worker de ingesta durante los tests (interferiría con la BD de test).
os.environ["INGEST_WORKER_AUTOSTART"] = "false"


@pytest.fixture(autouse=True)
def _openai_key_for_http_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Las rutas de IA leen la clave solo desde BD; en tests simulamos una clave válida."""
    from backend.app import openai_key_runtime

    monkeypatch.setattr(
        openai_key_runtime,
        "resolve_openai_api_key_for_owner",
        lambda db, owner_id: "sk-test-placeholder-integration",
    )


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
    # Sin admin inicial en BD: el lifespan exige SETUP_MASTER_PASSWORD o ADMIN_*.
    os.environ.setdefault("SETUP_MASTER_PASSWORD", "pytest_integration_setup_master")

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
        conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS arcs CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS alembic_version CASCADE"))

    command.upgrade(alembic_cfg, "head")

    yield


from backend.tests.helpers import ensure_test_admin_exists


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
        conn.execute(
            text(
                "DO $$ BEGIN IF to_regclass('public.users') IS NOT NULL THEN "
                "TRUNCATE TABLE users; END IF; END $$;"
            )
        )
    yield


@pytest.fixture()
def client() -> TestClient:
    from backend.app.main import app

    ensure_test_admin_exists()
    c = TestClient(app)
    reg = c.post("/api/auth/register", json={"username": "pytest_user", "password": "pytest_pw_12"})
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


@pytest.fixture()
def admin_client() -> TestClient:
    """Cliente HTTP con JWT de usuario `is_admin=true` creado en BD (sin depender de ADMIN_* en .env)."""
    from backend.app.auth_jwt import create_access_token
    from backend.app.auth_password import hash_password
    from backend.app.db import get_sessionmaker
    from backend.app.main import app
    from backend.app.user_repo import create_user

    c = TestClient(app)
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        u = create_user(
            db,
            username_normalized="pytest_admin_fixture",
            password_hash=hash_password("pytest_admin_pw_12"),
            is_admin=True,
        )
        uid = u.id
    token = create_access_token(user_id=uid, is_admin=True)
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


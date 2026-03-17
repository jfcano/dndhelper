from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db import get_db
from backend.app.main import app
from backend.app.models import Base


@pytest.fixture()
def client():
    """Cliente de test sin dependencia de BD."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def postgres_test_url() -> str:
    url = os.getenv("POSTGRES_TEST_URL")
    if not url:
        raise RuntimeError(
            "Falta POSTGRES_TEST_URL para ejecutar tests de BD. "
            "Ejemplo: postgresql+psycopg://user:pass@host:5432/db_test"
        )
    return url


@pytest.fixture(scope="session")
def engine(postgres_test_url: str):
    engine = create_engine(postgres_test_url, pool_pre_ping=True, connect_args={"connect_timeout": 5})
    # Necesario para tests que usen PGVector en Postgres de test
    with engine.begin() as conn:
        conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector;")
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session(engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def db_client(db_session):
    """Cliente de test con BD override (usa POSTGRES_TEST_URL)."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


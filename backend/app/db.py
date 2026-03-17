from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.config import get_settings


_engine = None
_SessionLocal = None


def get_engine():
    settings = get_settings()
    if not settings.postgres_url:
        raise RuntimeError("Falta POSTGRES_URL en el entorno.")
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.postgres_url,
            pool_pre_ping=True,
            connect_args={"connect_timeout": settings.postgres_connect_timeout_s},
        )
    return _engine


def get_sessionmaker():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=get_engine())
    return _SessionLocal


def get_db():
    SessionLocal = get_sessionmaker()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


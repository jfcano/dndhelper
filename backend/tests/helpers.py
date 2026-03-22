"""Utilidades compartidas para tests de integración."""
from __future__ import annotations

import os

from backend.app.auth_password import hash_password
from backend.app.db import get_sessionmaker
from backend.app.user_repo import create_user, get_user_by_username


def ensure_test_admin_exists() -> None:
    """Crea un administrador de pruebas si la BD no tiene ninguno (necesario para POST /api/auth/register)."""
    postgres_url = os.getenv("POSTGRES_URL") or os.getenv("POSTGRES_TEST_URL")
    if not postgres_url:
        return
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        if get_user_by_username(db, "pytest_seed_admin"):
            return
        create_user(
            db,
            username_normalized="pytest_seed_admin",
            password_hash=hash_password("pytest_seed_admin_pw_12"),
            is_admin=True,
        )

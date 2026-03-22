from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from backend.app.auth_password import hash_password
from backend.app.config import get_settings
from backend.app.db import get_db
from backend.app.user_repo import create_user, get_user_by_username, has_any_admin

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupStatusResponse(BaseModel):
    needs_setup: bool
    setup_available: bool


class SetupBootstrapRequest(BaseModel):
    master_password: str = Field(min_length=1, max_length=512)
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username", mode="before")
    @classmethod
    def _strip_username(cls, v: object) -> object:
        return v.strip() if isinstance(v, str) else v


def _normalize_username(raw: str) -> str:
    return raw.strip().lower()


@router.get("/status", response_model=SetupStatusResponse)
def setup_status(db: Session = Depends(get_db)) -> SetupStatusResponse:
    s = get_settings()
    needs = not has_any_admin(db)
    master = bool(s.setup_master_password)
    return SetupStatusResponse(needs_setup=needs, setup_available=needs and master)


@router.post("/", status_code=201)
def setup_bootstrap(payload: SetupBootstrapRequest, db: Session = Depends(get_db)) -> dict:
    s = get_settings()
    if s.admin_username and s.admin_password:
        raise HTTPException(
            status_code=403,
            detail="La instalación por interfaz está deshabilitada: ya hay credenciales de administrador en el entorno.",
        )
    if has_any_admin(db):
        raise HTTPException(status_code=409, detail="Ya existe un administrador en la base de datos.")
    if not s.setup_master_password:
        raise HTTPException(
            status_code=503,
            detail="SETUP_MASTER_PASSWORD no está configurada en el servidor.",
        )
    if not secrets.compare_digest(payload.master_password, s.setup_master_password):
        raise HTTPException(status_code=401, detail="Contraseña maestra incorrecta.")

    uname = _normalize_username(payload.username)
    if get_user_by_username(db, uname):
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso.")

    create_user(
        db,
        username_normalized=uname,
        password_hash=hash_password(payload.password),
        is_admin=True,
    )
    return {"ok": True}

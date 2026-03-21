from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.auth_jwt import create_access_token
from backend.app.auth_password import hash_password, verify_password
from backend.app.db import get_db
from backend.app.owner_context import get_owner_id
from backend.app.schemas import AuthTokenResponse, UserLogin, UserPublic, UserRegister
from backend.app.user_repo import create_user, get_user_by_id, get_user_by_username

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_username(raw: str) -> str:
    return raw.strip().lower()


@router.post("/register", response_model=AuthTokenResponse)
def register(payload: UserRegister, db: Session = Depends(get_db)) -> AuthTokenResponse:
    uname = _normalize_username(payload.username)
    if len(uname) < 3:
        raise HTTPException(status_code=400, detail="El nombre de usuario es demasiado corto.")
    if get_user_by_username(db, uname):
        raise HTTPException(status_code=409, detail="Ese nombre de usuario ya está en uso.")
    ph = hash_password(payload.password)
    user = create_user(db, username_normalized=uname, password_hash=ph, is_admin=False)
    token = create_access_token(user_id=user.id, is_admin=False)
    return AuthTokenResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.post("/login", response_model=AuthTokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)) -> AuthTokenResponse:
    uname = _normalize_username(payload.username)
    user = get_user_by_username(db, uname)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos.")
    token = create_access_token(user_id=user.id, is_admin=bool(user.is_admin))
    return AuthTokenResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


@router.get("/me", response_model=UserPublic)
def me(db: Session = Depends(get_db)) -> UserPublic:
    uid = get_owner_id()
    user = get_user_by_id(db, uid)
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado.")
    return UserPublic.model_validate(user)

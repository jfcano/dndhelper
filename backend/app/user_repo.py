from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.auth_password import hash_password
from backend.app.config import get_settings
from backend.app.models import User


def get_user_by_username(db: Session, username_normalized: str) -> User | None:
    return db.scalar(select(User).where(User.username == username_normalized))


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return db.get(User, user_id)


def create_user(
    db: Session,
    *,
    username_normalized: str,
    password_hash: str,
    is_admin: bool = False,
) -> User:
    u = User(
        id=uuid4(),
        username=username_normalized,
        password_hash=password_hash,
        is_admin=is_admin,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def ensure_admin_user_from_env(db: Session) -> None:
    """Crea el usuario administrador si `ADMIN_USERNAME` y `ADMIN_PASSWORD` están definidos en el entorno."""
    s = get_settings()
    if not s.admin_username or not s.admin_password:
        return
    uname = s.admin_username.strip().lower()
    u = get_user_by_username(db, uname)
    if u:
        if not u.is_admin:
            u.is_admin = True
            db.commit()
        return
    create_user(
        db,
        username_normalized=uname,
        password_hash=hash_password(s.admin_password),
        is_admin=True,
    )

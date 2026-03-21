from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt

from backend.app.config import get_settings


@dataclass(frozen=True)
class AccessTokenPayload:
    user_id: UUID
    is_admin: bool


def create_access_token(*, user_id: UUID, is_admin: bool = False) -> str:
    s = get_settings()
    now = datetime.now(timezone.utc)
    exp_ts = int((now + timedelta(minutes=s.jwt_expire_minutes)).timestamp())
    payload = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": exp_ts,
        "adm": bool(is_admin),
    }
    return jwt.encode(payload, s.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> AccessTokenPayload:
    s = get_settings()
    try:
        data = jwt.decode(token, s.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as e:
        raise ValueError("Token inválido o caducado.") from e
    sub = data.get("sub")
    if not sub:
        raise ValueError("Token sin sujeto.")
    return AccessTokenPayload(user_id=UUID(str(sub)), is_admin=bool(data.get("adm", False)))

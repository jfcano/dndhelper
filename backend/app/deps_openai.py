from __future__ import annotations
from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.openai_key_runtime import (
    MISSING_OPENAI_KEY_HTTP_DETAIL,
    bind_request_openai_api_key,
    reset_request_openai_api_key,
    resolve_openai_api_key_for_owner,
)
from backend.app.owner_context import get_owner_id


async def require_openai_api_key_ctx(db: Session = Depends(get_db)) -> AsyncGenerator[str, None]:
    """
    Resuelve la clave OpenAI (solo BD / Ajustes).

    Debe ser un generador *async* para que ``ContextVar.set`` / ``reset`` ocurran en la misma
    tarea asyncio que la ruta.
    """
    owner_id = get_owner_id()
    key = resolve_openai_api_key_for_owner(db, owner_id)
    if not key:
        raise HTTPException(status_code=400, detail=MISSING_OPENAI_KEY_HTTP_DETAIL)
    token = bind_request_openai_api_key(key)
    try:
        yield key
    finally:
        reset_request_openai_api_key(token)

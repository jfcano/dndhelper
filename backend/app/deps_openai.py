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
    Resuelve la clave (BD del propietario o entorno), la inyecta en contexto de petición
    y la devuelve. Si no hay clave, 400 con mensaje para ir a Ajustes.

    Debe ser un generador *async* para que ``ContextVar.set`` / ``reset`` ocurran en la misma
    tarea asyncio que la ruta. Con un generador síncrono, Starlette puede ejecutar la
    limpieza en otro contexto y Python 3.10+ lanza:
    ``ValueError: ... Token ... was created in a different Context``.
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

from __future__ import annotations

from contextvars import ContextVar
from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.owner_settings_repo import get_owner_settings

# Clave OpenAI por petición HTTP (Depends) o contexto del worker tras resolver desde BD.

_openai_api_key_ctx: ContextVar[str | None] = ContextVar("openai_api_key_request", default=None)

MISSING_OPENAI_KEY_HTTP_DETAIL = (
    "Configura tu clave de API de OpenAI en Ajustes para usar las funciones de IA (generación y consultas RAG). "
    "Ya no se lee desde el fichero .env."
)


def bind_request_openai_api_key(key: str) -> object:
    return _openai_api_key_ctx.set(key.strip())


def reset_request_openai_api_key(token: object) -> None:
    _openai_api_key_ctx.reset(token)


def get_request_openai_api_key() -> str | None:
    v = _openai_api_key_ctx.get()
    if v and str(v).strip():
        return str(v).strip()
    return None


def resolve_openai_api_key_for_owner(db: Session, owner_id: UUID) -> str | None:
    """Clave guardada en BD para el propietario (Ajustes)."""
    row = get_owner_settings(db, owner_id)
    if row and row.openai_api_key and str(row.openai_api_key).strip():
        return str(row.openai_api_key).strip()
    return None


def get_openai_key_for_llm_and_embeddings() -> str:
    """
    Clave para llamadas a OpenAI (chat, embeddings, imágenes).
    En peticiones HTTP debe existir contexto establecido por Depends(require_openai_api_key_ctx).
    En el worker de ingesta, el contexto se rellena con bind_request_openai_api_key tras resolver desde BD.
    """
    ctx = get_request_openai_api_key()
    if ctx:
        return ctx
    raise RuntimeError(
        "Falta clave de API de OpenAI. Configúrala en Ajustes en la aplicación."
    )

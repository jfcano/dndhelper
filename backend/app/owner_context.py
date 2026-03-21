from __future__ import annotations

from contextvars import ContextVar, Token
from uuid import UUID

_owner_id_var: ContextVar[UUID | None] = ContextVar("owner_id", default=None)
_is_admin_var: ContextVar[bool] = ContextVar("is_admin", default=False)


def set_auth_context(user_id: UUID, *, is_admin: bool) -> tuple[Token, Token]:
    """Usado por el middleware de autenticación (JWT)."""
    return _owner_id_var.set(user_id), _is_admin_var.set(is_admin)


def reset_auth_context(tokens: tuple[Token, Token]) -> None:
    _is_admin_var.reset(tokens[1])
    _owner_id_var.reset(tokens[0])


def get_owner_id() -> UUID:
    """
    Usuario autenticado (JWT) para esta petición.
    Sin middleware de auth válido, falla: las rutas /api protegidas deben ir con Bearer token.
    """
    v = _owner_id_var.get()
    if v is None:
        raise RuntimeError("No hay usuario autenticado en el contexto de la petición.")
    return v


def is_admin() -> bool:
    return bool(_is_admin_var.get())

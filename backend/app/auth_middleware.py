from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from backend.app.auth_jwt import decode_access_token
from backend.app.owner_context import reset_auth_context, set_auth_context

logger = logging.getLogger(__name__)


def _path_public(path: str, method: str) -> bool:
    if path == "/health":
        return True
    if path in ("/docs", "/openapi.json", "/redoc"):
        return True
    if path == "/" and method == "GET":
        return True
    if path.startswith("/admin"):
        return True
    p = path.rstrip("/") or "/"
    if p == "/api/auth/register" and method == "POST":
        return True
    if p == "/api/auth/login" and method == "POST":
        return True
    return False


class AuthContextMiddleware(BaseHTTPMiddleware):
    """Exige JWT en /api salvo registro/login; fija el contexto de propietario para get_owner_id()."""

    async def dispatch(self, request, call_next) -> Response:
        path = request.url.path
        method = request.method.upper()

        if not path.startswith("/api"):
            return await call_next(request)

        if method == "OPTIONS":
            return await call_next(request)

        if _path_public(path, method):
            return await call_next(request)

        auth = request.headers.get("Authorization")
        if not auth or not auth.startswith("Bearer "):
            return JSONResponse(
                status_code=401,
                content={"detail": "Autenticación requerida. Inicia sesión o regístrate."},
            )
        raw = auth.removeprefix("Bearer ").strip()
        if not raw:
            return JSONResponse(status_code=401, content={"detail": "Token vacío."})
        try:
            payload = decode_access_token(raw)
        except ValueError as e:
            logger.info("JWT rechazado: %s", e)
            return JSONResponse(status_code=401, content={"detail": "Sesión no válida o caducada. Vuelve a iniciar sesión."})

        tok = set_auth_context(payload.user_id, is_admin=payload.is_admin)
        try:
            return await call_next(request)
        finally:
            reset_auth_context(tok)

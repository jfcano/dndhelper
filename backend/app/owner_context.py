from __future__ import annotations

from uuid import UUID

from backend.app.config import get_settings


def get_owner_id() -> UUID:
    """
    Contexto de "usuario actual" para el MVP sin autenticación.
    Se controla con LOCAL_OWNER_UUID en el entorno.
    """
    settings = get_settings()
    try:
        return UUID(settings.local_owner_uuid)
    except Exception as e:  # noqa: BLE001
        raise RuntimeError("LOCAL_OWNER_UUID no es un UUID válido.") from e


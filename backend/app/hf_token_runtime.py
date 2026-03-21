from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.owner_settings_repo import get_owner_settings


def resolve_hf_token_for_owner(db: Session, owner_id: UUID) -> str | None:
    """Token Hugging Face (Hub) desde `owner_settings`; solo base de datos."""
    row = get_owner_settings(db, owner_id)
    if row and row.hf_token and str(row.hf_token).strip():
        return str(row.hf_token).strip()
    return None

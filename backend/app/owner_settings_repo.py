from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from backend.app.models import OwnerSettings


def get_owner_settings(db: Session, owner_id: UUID) -> OwnerSettings | None:
    return db.get(OwnerSettings, owner_id)


def upsert_openai_api_key(db: Session, owner_id: UUID, openai_api_key: str | None) -> OwnerSettings:
    row = get_owner_settings(db, owner_id)
    if row is None:
        row = OwnerSettings(owner_id=owner_id, openai_api_key=openai_api_key)
        db.add(row)
    else:
        row.openai_api_key = openai_api_key
    db.commit()
    db.refresh(row)
    return row

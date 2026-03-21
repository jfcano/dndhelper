"""Unicidad de nombres de mundo por propietario (MVP sin restricción UNIQUE en BD)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.models import World


def normalize_world_name(name: str) -> str:
    return (name or "").strip().lower()


def is_world_name_taken(
    db: Session,
    owner_id: UUID,
    name: str,
    *,
    exclude_world_id: UUID | None = None,
) -> bool:
    """True si otro mundo del mismo propietario ya usa este nombre (misma normalización)."""
    n = normalize_world_name(name)
    if not n:
        return False
    stmt = select(World.id).where(
        World.owner_id == owner_id,
        func.lower(func.trim(World.name)) == n,
    )
    if exclude_world_id is not None:
        stmt = stmt.where(World.id != exclude_world_id)
    return db.execute(stmt).first() is not None

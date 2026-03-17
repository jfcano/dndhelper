from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import World
from backend.app.owner_context import get_owner_id
from backend.app.schemas import WorldCreate, WorldGenerate, WorldOut, WorldUpdate
from backend.app.services import generation_service

router = APIRouter(prefix="/worlds", tags=["worlds"])


@router.post("", response_model=WorldOut)
def create_world(payload: WorldCreate, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    obj = World(owner_id=owner_id, name=payload.name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post(":generate", response_model=WorldOut)
def generate_world(payload: WorldGenerate, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    gw = generation_service.generate_world_from_description(description=payload.description)
    obj = World(
        owner_id=owner_id,
        name=gw.name,
        pitch=gw.pitch,
        tone=gw.tone,
        themes=gw.themes,
        content_draft=gw.content_draft,
        status="draft",
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("", response_model=list[WorldOut])
def list_worlds(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)) -> list[WorldOut]:
    owner_id = get_owner_id()
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    stmt = select(World).where(World.owner_id == owner_id).order_by(World.created_at.desc()).limit(limit).offset(offset)
    return list(db.execute(stmt).scalars().all())


@router.get("/{world_id}", response_model=WorldOut)
def get_world(world_id: UUID, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    return obj


@router.patch("/{world_id}", response_model=WorldOut)
def patch_world(world_id: UUID, payload: WorldUpdate, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{world_id}/approve", response_model=WorldOut)
def approve_world(world_id: UUID, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    obj.content_final = obj.content_draft
    obj.status = "approved"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


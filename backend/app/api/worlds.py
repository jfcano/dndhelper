from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import Campaign, World
from backend.app.owner_context import get_owner_id
from backend.app.schemas import WorldCreate, WorldGenerate, WorldOut, WorldUpdate, WorldWizardAutogenerateRequest
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
    faction_names = {f.name.strip().lower() for f in payload.factions}
    missing = sorted(
        {
            c.faction_name.strip()
            for c in payload.characters
            if c.faction_name.strip().lower() not in faction_names
        }
    )
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Hay personajes con facción no definida en el paso de facciones: {', '.join(missing)}",
        )

    gw = generation_service.generate_world_from_wizard(
        theme_and_mood=payload.theme_and_mood,
        factions=[f.model_dump() for f in payload.factions],
        characters=[c.model_dump() for c in payload.characters],
        cities=[c.model_dump() for c in payload.cities],
    )
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


@router.post(":wizard/autogenerate")
def autogenerate_world_wizard_step(payload: WorldWizardAutogenerateRequest) -> dict:
    patch = generation_service.autogenerate_world_wizard_step(
        step=payload.step,
        wizard=payload.wizard.model_dump(),
    )
    return {"step": payload.step, "patch": patch}


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


@router.get("/{world_id}/usage")
def get_world_usage(world_id: UUID, db: Session = Depends(get_db)) -> dict:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")

    usage_stmt = select(func.count(Campaign.id)).where(
        Campaign.owner_id == owner_id,
        Campaign.world_id == world_id,
    )
    campaign_count = int(db.execute(usage_stmt).scalar_one() or 0)
    return {"campaign_count": campaign_count}


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


@router.delete("/{world_id}")
def delete_world(world_id: UUID, db: Session = Depends(get_db)) -> dict:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")

    usage_stmt = select(func.count(Campaign.id)).where(
        Campaign.owner_id == owner_id,
        Campaign.world_id == world_id,
    )
    campaign_count = int(db.execute(usage_stmt).scalar_one() or 0)
    if campaign_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"No se puede borrar el world porque está siendo usado por {campaign_count} campaign(s).",
        )

    db.delete(obj)
    db.commit()
    return {"ok": True}


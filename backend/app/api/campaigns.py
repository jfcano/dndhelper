from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import json

from backend.app import crud
from backend.app.db import get_db
from backend.app.models import Campaign, World
from backend.app.owner_context import get_owner_id
from backend.app.schemas import CampaignBrief, CampaignCreate, CampaignOut, CampaignUpdate
from backend.app.services import generation_service
from sqlalchemy import select

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.post("", response_model=CampaignOut)
def create(payload: CampaignCreate, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    return crud.create_campaign(db, owner_id, payload)


@router.get("", response_model=list[CampaignOut])
def list_(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)) -> list[CampaignOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    owner_id = get_owner_id()
    return crud.list_campaigns(db, owner_id, limit=limit, offset=offset)


@router.get("/{campaign_id}", response_model=CampaignOut)
def get(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    return obj


@router.patch("/{campaign_id}", response_model=CampaignOut)
def patch(campaign_id: UUID, payload: CampaignUpdate, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    return crud.update_campaign(db, obj, payload)


@router.delete("/{campaign_id}")
def delete(campaign_id: UUID, db: Session = Depends(get_db)) -> dict:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    crud.delete_campaign(db, obj)
    return {"ok": True}


@router.post("/{campaign_id}/brief", response_model=CampaignOut)
def set_brief(campaign_id: UUID, payload: CampaignBrief, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    obj.brief_draft = payload.model_dump()
    obj.brief_status = "draft"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{campaign_id}/brief", response_model=CampaignOut)
def patch_brief(campaign_id: UUID, payload: CampaignBrief, db: Session = Depends(get_db)) -> CampaignOut:
    # Reutilizamos el mismo schema; en MVP se envía completo.
    return set_brief(campaign_id, payload, db)


@router.post("/{campaign_id}/brief/approve", response_model=CampaignOut)
def approve_brief(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if not obj.brief_draft:
        raise HTTPException(status_code=400, detail="No hay brief_draft para aprobar.")
    obj.brief_final = obj.brief_draft
    obj.brief_status = "approved"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{campaign_id}/world:generate", response_model=CampaignOut)
def generate_world_for_campaign(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar el mundo.")

    gw = generation_service.generate_world(brief=campaign.brief_final)
    world = World(
        owner_id=owner_id,
        name=gw.name,
        pitch=gw.pitch,
        tone=gw.tone,
        themes=gw.themes,
        content_draft=json.dumps(gw.draft, ensure_ascii=False),
        status="draft",
    )
    db.add(world)
    db.commit()
    db.refresh(world)

    campaign.world_id = world.id
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/outline:generate", response_model=CampaignOut)
def generate_outline_for_campaign(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar el outline.")
    if not campaign.world_id:
        raise HTTPException(status_code=400, detail="La campaign debe tener world_id antes de generar el outline.")

    stmt = select(World).where(World.id == campaign.world_id, World.owner_id == owner_id)
    world = db.execute(stmt).scalars().first()
    if not world:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    if world.status != "approved" or not world.content_final:
        raise HTTPException(status_code=400, detail="El world debe estar aprobado antes de generar el outline.")

    world_payload = {
        "id": str(world.id),
        "name": world.name,
        "pitch": world.pitch,
        "tone": world.tone,
        "themes": world.themes,
        "content": world.content_final,
    }
    go = generation_service.generate_outline(brief=campaign.brief_final, world=world_payload)
    campaign.outline_draft = json.dumps(go.raw, ensure_ascii=False)
    campaign.outline_status = "draft"
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.patch("/{campaign_id}/outline", response_model=CampaignOut)
def patch_outline(campaign_id: UUID, payload: dict, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    campaign.outline_draft = json.dumps(payload, ensure_ascii=False)
    campaign.outline_status = "draft"
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/outline/approve", response_model=CampaignOut)
def approve_outline(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if not campaign.outline_draft:
        raise HTTPException(status_code=400, detail="No hay outline_draft para aprobar.")
    campaign.outline_final = campaign.outline_draft
    campaign.outline_status = "approved"
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


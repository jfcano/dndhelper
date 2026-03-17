from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.owner_context import get_owner_id
from backend.app.schemas import CampaignCreate, CampaignOut, CampaignUpdate

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


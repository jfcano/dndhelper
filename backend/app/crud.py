from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Campaign
from backend.app.schemas import CampaignCreate, CampaignUpdate


def create_campaign(db: Session, payload: CampaignCreate) -> Campaign:
    obj = Campaign(
        name=payload.name,
        system=payload.system,
        tone=payload.tone,
        starting_level=payload.starting_level,
        goals=payload.goals,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_campaigns(db: Session, *, limit: int = 50, offset: int = 0) -> list[Campaign]:
    stmt = select(Campaign).order_by(Campaign.created_at.desc()).limit(limit).offset(offset)
    return list(db.execute(stmt).scalars().all())


def get_campaign(db: Session, campaign_id: UUID) -> Campaign | None:
    stmt = select(Campaign).where(Campaign.id == campaign_id)
    return db.execute(stmt).scalars().first()


def update_campaign(db: Session, obj: Campaign, payload: CampaignUpdate) -> Campaign:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete_campaign(db: Session, obj: Campaign) -> None:
    db.delete(obj)
    db.commit()


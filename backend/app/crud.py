from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.app.models import Campaign, Session as CampaignSession
from backend.app.schemas import CampaignCreate, CampaignUpdate, SessionCreate, SessionUpdate


def create_campaign(db: Session, owner_id: UUID, payload: CampaignCreate) -> Campaign:
    obj = Campaign(
        owner_id=owner_id,
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


def list_campaigns(db: Session, owner_id: UUID, *, limit: int = 50, offset: int = 0) -> list[Campaign]:
    stmt = (
        select(Campaign)
        .where(Campaign.owner_id == owner_id)
        .order_by(Campaign.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


def get_campaign(db: Session, owner_id: UUID, campaign_id: UUID) -> Campaign | None:
    stmt = select(Campaign).where(Campaign.id == campaign_id, Campaign.owner_id == owner_id)
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


def create_session(db: Session, owner_id: UUID, campaign_id: UUID, payload: SessionCreate) -> CampaignSession:
    campaign = get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise LookupError("Campaign no encontrada.")
    obj = CampaignSession(
        campaign_id=campaign_id,
        session_number=payload.session_number,
        title=payload.title,
        summary=payload.summary,
        status=payload.status,
        notes=payload.notes,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_sessions_by_campaign(
    db: Session, owner_id: UUID, campaign_id: UUID, *, limit: int = 50, offset: int = 0
) -> list[CampaignSession]:
    if not get_campaign(db, owner_id, campaign_id):
        raise LookupError("Campaign no encontrada.")
    stmt = (
        select(CampaignSession)
        .where(CampaignSession.campaign_id == campaign_id)
        .order_by(CampaignSession.session_number.asc(), CampaignSession.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


def delete_sessions_by_campaign(db: Session, owner_id: UUID, campaign_id: UUID) -> None:
    if not get_campaign(db, owner_id, campaign_id):
        raise LookupError("Campaign no encontrada.")
    stmt = delete(CampaignSession).where(CampaignSession.campaign_id == campaign_id)
    db.execute(stmt)
    db.commit()


def get_session(db: Session, owner_id: UUID, session_id: UUID) -> CampaignSession | None:
    stmt = (
        select(CampaignSession)
        .join(Campaign, Campaign.id == CampaignSession.campaign_id)
        .where(CampaignSession.id == session_id, Campaign.owner_id == owner_id)
    )
    return db.execute(stmt).scalars().first()


def update_session(db: Session, obj: CampaignSession, payload: SessionUpdate) -> CampaignSession:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete_session(db: Session, obj: CampaignSession) -> None:
    db.delete(obj)
    db.commit()


def renumber_sessions_for_campaign(db: Session, campaign_id: UUID) -> None:
    stmt = (
        select(CampaignSession)
        .where(CampaignSession.campaign_id == campaign_id)
        .order_by(CampaignSession.session_number.asc(), CampaignSession.created_at.asc())
    )
    rows = list(db.execute(stmt).scalars().all())
    changed = False
    for idx, row in enumerate(rows, start=1):
        if row.session_number != idx:
            row.session_number = idx
            db.add(row)
            changed = True
    if changed:
        db.commit()


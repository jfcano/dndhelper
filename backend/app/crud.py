from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.models import Arc, Campaign, Session as CampaignSession
from backend.app.schemas import (
    ArcCreate,
    ArcUpdate,
    CampaignCreate,
    CampaignUpdate,
    SessionCreate,
    SessionUpdate,
)


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


def create_arc(db: Session, owner_id: UUID, campaign_id: UUID, payload: ArcCreate) -> Arc:
    if not get_campaign(db, owner_id, campaign_id):
        raise LookupError("Campaign no encontrada.")
    obj = Arc(
        campaign_id=campaign_id,
        title=payload.title,
        summary=payload.summary,
        order_index=payload.order_index,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def list_arcs(db: Session, owner_id: UUID, campaign_id: UUID, *, limit: int = 50, offset: int = 0) -> list[Arc]:
    if not get_campaign(db, owner_id, campaign_id):
        raise LookupError("Campaign no encontrada.")
    stmt = (
        select(Arc)
        .where(Arc.campaign_id == campaign_id)
        .order_by(Arc.order_index.asc(), Arc.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


def get_arc(db: Session, owner_id: UUID, arc_id: UUID) -> Arc | None:
    stmt = (
        select(Arc)
        .join(Campaign, Campaign.id == Arc.campaign_id)
        .where(Arc.id == arc_id, Campaign.owner_id == owner_id)
    )
    return db.execute(stmt).scalars().first()


def update_arc(db: Session, obj: Arc, payload: ArcUpdate) -> Arc:
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def delete_arc(db: Session, obj: Arc) -> None:
    db.delete(obj)
    db.commit()


def create_session(db: Session, owner_id: UUID, arc_id: UUID, payload: SessionCreate) -> CampaignSession:
    arc = get_arc(db, owner_id, arc_id)
    if not arc:
        raise LookupError("Arc no encontrado.")
    obj = CampaignSession(
        campaign_id=arc.campaign_id,
        arc_id=arc_id,
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


def list_sessions_by_arc(
    db: Session, owner_id: UUID, arc_id: UUID, *, limit: int = 50, offset: int = 0
) -> list[CampaignSession]:
    arc = get_arc(db, owner_id, arc_id)
    if not arc:
        raise LookupError("Arc no encontrado.")
    stmt = (
        select(CampaignSession)
        .where(CampaignSession.campaign_id == arc.campaign_id, CampaignSession.arc_id == arc_id)
        .order_by(CampaignSession.session_number.asc(), CampaignSession.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


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


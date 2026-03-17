from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.models import Campaign
from backend.app.owner_context import get_owner_id
from backend.app.schemas import ArcCreate, ArcOut, ArcUpdate, SessionCreate, SessionOut
from backend.app.services import generation_service

router = APIRouter(tags=["arcs"])


@router.post("/campaigns/{campaign_id}/arcs", response_model=ArcOut)
def create_arc(campaign_id: UUID, payload: ArcCreate, db: Session = Depends(get_db)) -> ArcOut:
    owner_id = get_owner_id()
    try:
        return crud.create_arc(db, owner_id, campaign_id, payload)
    except LookupError:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.") from None


@router.get("/campaigns/{campaign_id}/arcs", response_model=list[ArcOut])
def list_arcs(
    campaign_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)
) -> list[ArcOut]:
    owner_id = get_owner_id()
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    try:
        return crud.list_arcs(db, owner_id, campaign_id, limit=limit, offset=offset)
    except LookupError:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.") from None


@router.get("/arcs/{arc_id}", response_model=ArcOut)
def get_arc(arc_id: UUID, db: Session = Depends(get_db)) -> ArcOut:
    owner_id = get_owner_id()
    obj = crud.get_arc(db, owner_id, arc_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    return obj


@router.patch("/arcs/{arc_id}", response_model=ArcOut)
def patch_arc(arc_id: UUID, payload: ArcUpdate, db: Session = Depends(get_db)) -> ArcOut:
    owner_id = get_owner_id()
    obj = crud.get_arc(db, owner_id, arc_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    return crud.update_arc(db, obj, payload)


@router.delete("/arcs/{arc_id}")
def delete_arc(arc_id: UUID, db: Session = Depends(get_db)) -> dict:
    owner_id = get_owner_id()
    obj = crud.get_arc(db, owner_id, arc_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    crud.delete_arc(db, obj)
    return {"ok": True}


@router.post("/arcs/{arc_id}/sessions", response_model=SessionOut)
def create_session(arc_id: UUID, payload: SessionCreate, db: Session = Depends(get_db)) -> SessionOut:
    owner_id = get_owner_id()
    try:
        return crud.create_session(db, owner_id, arc_id, payload)
    except LookupError:
        raise HTTPException(status_code=404, detail="Arc no encontrado.") from None


@router.get("/arcs/{arc_id}/sessions", response_model=list[SessionOut])
def list_sessions_for_arc(
    arc_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)
) -> list[SessionOut]:
    owner_id = get_owner_id()
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    try:
        return crud.list_sessions_by_arc(db, owner_id, arc_id, limit=limit, offset=offset)
    except LookupError:
        raise HTTPException(status_code=404, detail="Arc no encontrado.") from None


@router.post("/campaigns/{campaign_id}/arcs:generate", response_model=list[ArcOut])
def generate_arcs_for_campaign(
    campaign_id: UUID, arc_count: int = 3, db: Session = Depends(get_db)
) -> list[ArcOut]:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.outline_status != "approved" or not campaign.outline_final:
        raise HTTPException(status_code=400, detail="El outline debe estar aprobado antes de generar arcos.")

    outline_payload = {"outline": campaign.outline_final}
    arcs = generation_service.generate_arcs(outline=outline_payload, arc_count=max(1, min(arc_count, 20)))

    created: list[ArcOut] = []
    for idx, a in enumerate(arcs, start=1):
        title = str(a.get("title") or f"Arco {idx}")
        summary = a.get("summary")
        order_index = int(a.get("order_index") or idx)
        obj = crud.create_arc(db, owner_id, campaign_id, ArcCreate(title=title, summary=summary, order_index=order_index))
        created.append(obj)
    return created


@router.post("/arcs/{arc_id}/approve", response_model=ArcOut)
def approve_arc(arc_id: UUID, db: Session = Depends(get_db)) -> ArcOut:
    owner_id = get_owner_id()
    obj = crud.get_arc(db, owner_id, arc_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    obj.approval_status = "approved"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/arcs/{arc_id}/sessions:generate", response_model=list[SessionOut])
def generate_sessions_for_arc(
    arc_id: UUID, session_count: int = 3, db: Session = Depends(get_db)
) -> list[SessionOut]:
    owner_id = get_owner_id()
    arc = crud.get_arc(db, owner_id, arc_id)
    if not arc:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    if arc.approval_status != "approved":
        raise HTTPException(status_code=400, detail="El arco debe estar aprobado antes de generar sesiones.")

    # cargar campaign para recuperar outline_final
    stmt = select(Campaign).where(Campaign.id == arc.campaign_id, Campaign.owner_id == owner_id)
    campaign = db.execute(stmt).scalars().first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.outline_status != "approved" or not campaign.outline_final:
        raise HTTPException(status_code=400, detail="El outline debe estar aprobado antes de generar sesiones.")

    arc_payload = {"id": str(arc.id), "title": arc.title, "summary": arc.summary, "order_index": arc.order_index}
    outline_payload = {"outline": campaign.outline_final}
    sessions_raw = generation_service.generate_sessions(
        arc=arc_payload,
        outline=outline_payload,
        session_count=max(1, min(session_count, 20)),
        starting_session_number=1,
    )

    created: list[SessionOut] = []
    for s in sessions_raw:
        try:
            session_number = int(s.get("session_number") or 1)
        except Exception:
            session_number = 1
        title = str(s.get("title") or f"Sesión {session_number}")
        summary = s.get("summary")
        content = s.get("content_draft")
        obj = crud.create_session(
            db,
            owner_id,
            arc_id,
            SessionCreate(session_number=session_number, title=title, summary=summary, status="planned"),
        )
        # persistir detalle como draft
        if isinstance(content, (dict, list)):
            obj.content_draft = json.dumps(content, ensure_ascii=False)
        elif content is not None:
            obj.content_draft = str(content)
        else:
            obj.content_draft = json.dumps(s, ensure_ascii=False)
        db.add(obj)
        db.commit()
        db.refresh(obj)
        created.append(obj)

    return created


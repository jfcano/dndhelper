from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.owner_context import get_owner_id
from backend.app.services import generation_service
from backend.app.schemas import SessionOut, SessionUpdate

router = APIRouter(tags=["sessions"])


@router.get("/campaigns/{campaign_id}/sessions", response_model=list[SessionOut])
def list_sessions_for_campaign(
    campaign_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)
) -> list[SessionOut]:
    owner_id = get_owner_id()
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    try:
        return crud.list_sessions_by_campaign(db, owner_id, campaign_id, limit=limit, offset=offset)
    except LookupError:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.") from None


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: UUID, db: Session = Depends(get_db)) -> SessionOut:
    owner_id = get_owner_id()
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    return obj


@router.patch("/sessions/{session_id}", response_model=SessionOut)
def patch_session(session_id: UUID, payload: SessionUpdate, db: Session = Depends(get_db)) -> SessionOut:
    owner_id = get_owner_id()
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    if payload.played is not None:
        payload.status = "played" if payload.played else "planned"
    return crud.update_session(db, obj, payload)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: UUID, db: Session = Depends(get_db)) -> dict:
    owner_id = get_owner_id()
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    campaign_id = obj.campaign_id
    crud.delete_session(db, obj)
    crud.renumber_sessions_for_campaign(db, campaign_id)
    return {"ok": True}


@router.post("/sessions/{session_id}/approve", response_model=SessionOut)
def approve_session(session_id: UUID, db: Session = Depends(get_db)) -> SessionOut:
    owner_id = get_owner_id()
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    obj.content_final = obj.content_draft
    obj.approval_status = "approved"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/sessions/{session_id}/extend", response_model=SessionOut)
def extend_session_info(session_id: UUID, db: Session = Depends(get_db)) -> SessionOut:
    owner_id = get_owner_id()
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")

    campaign = crud.get_campaign(db, owner_id, obj.campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")

    story_md = campaign.story_final or campaign.story_draft or ""
    if not story_md.strip():
        raise HTTPException(status_code=400, detail="No hay resumen de campaña para extender la sesión.")

    extended_md = generation_service.extend_session_markdown(
        campaign_story_md=story_md,
        session_title=obj.title or "",
        session_summary=obj.summary or "",
        session_draft_md=obj.content_draft or "",
    )
    obj.content_draft = extended_md
    # Mantenemos un resumen corto derivado del markdown ampliado.
    first_non_empty = next((ln.strip() for ln in extended_md.splitlines() if ln.strip()), None)
    if first_non_empty:
        obj.summary = first_non_empty[:500]
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.schemas import SessionOut, SessionUpdate

router = APIRouter(tags=["sessions"])


@router.get("/campaigns/{campaign_id}/sessions", response_model=list[SessionOut])
def list_sessions_for_campaign(
    campaign_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)
) -> list[SessionOut]:
    if not crud.get_campaign(db, campaign_id):
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    return crud.list_sessions_by_campaign(db, campaign_id, limit=limit, offset=offset)


@router.get("/sessions/{session_id}", response_model=SessionOut)
def get_session(session_id: UUID, db: Session = Depends(get_db)) -> SessionOut:
    obj = crud.get_session(db, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    return obj


@router.patch("/sessions/{session_id}", response_model=SessionOut)
def patch_session(session_id: UUID, payload: SessionUpdate, db: Session = Depends(get_db)) -> SessionOut:
    obj = crud.get_session(db, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    return crud.update_session(db, obj, payload)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: UUID, db: Session = Depends(get_db)) -> dict:
    obj = crud.get_session(db, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    crud.delete_session(db, obj)
    return {"ok": True}


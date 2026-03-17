from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.owner_context import get_owner_id
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
    return crud.update_session(db, obj, payload)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: UUID, db: Session = Depends(get_db)) -> dict:
    owner_id = get_owner_id()
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    crud.delete_session(db, obj)
    return {"ok": True}


from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.owner_context import get_owner_id
from backend.app.schemas import ArcCreate, ArcOut, ArcUpdate, SessionCreate, SessionOut

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


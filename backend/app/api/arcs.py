from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.schemas import ArcCreate, ArcOut, ArcUpdate, SessionCreate, SessionOut

router = APIRouter(tags=["arcs"])


@router.post("/campaigns/{campaign_id}/arcs", response_model=ArcOut)
def create_arc(campaign_id: UUID, payload: ArcCreate, db: Session = Depends(get_db)) -> ArcOut:
    # validar que la campaña existe
    if not crud.get_campaign(db, campaign_id):
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    return crud.create_arc(db, campaign_id, payload)


@router.get("/campaigns/{campaign_id}/arcs", response_model=list[ArcOut])
def list_arcs(
    campaign_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)
) -> list[ArcOut]:
    if not crud.get_campaign(db, campaign_id):
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    return crud.list_arcs(db, campaign_id, limit=limit, offset=offset)


@router.get("/arcs/{arc_id}", response_model=ArcOut)
def get_arc(arc_id: UUID, db: Session = Depends(get_db)) -> ArcOut:
    obj = crud.get_arc(db, arc_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    return obj


@router.patch("/arcs/{arc_id}", response_model=ArcOut)
def patch_arc(arc_id: UUID, payload: ArcUpdate, db: Session = Depends(get_db)) -> ArcOut:
    obj = crud.get_arc(db, arc_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    return crud.update_arc(db, obj, payload)


@router.delete("/arcs/{arc_id}")
def delete_arc(arc_id: UUID, db: Session = Depends(get_db)) -> dict:
    obj = crud.get_arc(db, arc_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    crud.delete_arc(db, obj)
    return {"ok": True}


@router.post("/arcs/{arc_id}/sessions", response_model=SessionOut)
def create_session(arc_id: UUID, payload: SessionCreate, db: Session = Depends(get_db)) -> SessionOut:
    arc = crud.get_arc(db, arc_id)
    if not arc:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    return crud.create_session(db, arc.campaign_id, arc_id, payload)


@router.get("/arcs/{arc_id}/sessions", response_model=list[SessionOut])
def list_sessions_for_arc(
    arc_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)
) -> list[SessionOut]:
    arc = crud.get_arc(db, arc_id)
    if not arc:
        raise HTTPException(status_code=404, detail="Arc no encontrado.")
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    return crud.list_sessions_by_arc(db, arc.campaign_id, arc_id, limit=limit, offset=offset)


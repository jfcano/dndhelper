from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.db import get_db
from backend.app.owner_context import get_owner_id
from backend.app.schemas import SessionOut, SessionUpdate

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sessions"])


def _list_sessions_all_for_owner(limit: int, offset: int, db: Session) -> list[SessionOut]:
    owner_id = get_owner_id()
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    return crud.list_sessions_for_owner(db, owner_id, limit=limit, offset=offset)


# Listado global: NO usar `/sessions/list` — en Starlette puede resolverse como `/sessions/{session_id}` con
# session_id="list" (error de UUID). Usamos `/all-sessions` (sin colisión).


@router.get(
    "/all-sessions",
    response_model=list[SessionOut],
    operation_id="list_all_sessions_all_sessions_path",
    summary="Listar todas las sesiones (ruta estable)",
    description="Igual que GET /api/sessions. Usar esta URL si el enrutador confunde otras rutas.",
)
def list_all_sessions_stable_path(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)) -> list[SessionOut]:
    return _list_sessions_all_for_owner(limit, offset, db)


@router.get(
    "/sessions",
    response_model=list[SessionOut],
    operation_id="list_all_sessions",
    summary="Listar todas las sesiones",
    description="Sesiones de todas las campañas del propietario (MVP: LOCAL_OWNER_UUID), con paginación.",
)
def list_all_sessions(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)) -> list[SessionOut]:
    return _list_sessions_all_for_owner(limit, offset, db)


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


# Rutas con segmento fijo tras `{session_id}` deben ir ANTES de GET/PATCH/DELETE en `/sessions/{session_id}`
# para que el árbol de rutas y OpenAPI/Swagger las resuelvan sin ambigüedad.


@router.post(
    "/sessions/{session_id}/approve",
    response_model=SessionOut,
    operation_id="approve_session",
    summary="Aprobar sesión",
)
def approve_session(session_id: UUID, db: Session = Depends(get_db)) -> SessionOut:
    owner_id = get_owner_id()
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    if (obj.approval_status or "").strip().lower() == "approved":
        return obj
    obj.content_final = obj.content_draft
    obj.approval_status = "approved"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post(
    "/sessions/{session_id}/reopen",
    response_model=SessionOut,
    operation_id="reopen_session_to_draft",
    summary="Volver sesión a borrador",
    description=(
        "Pasa una sesión aprobada a estado borrador para poder editar resumen y guion. "
        "Si ya estaba en borrador, no hace cambios."
    ),
)
def reopen_session_to_draft(session_id: UUID, db: Session = Depends(get_db)) -> SessionOut:
    owner_id = get_owner_id()
    logger.info(
        "session.reopen: solicitud session_id=%s owner_id=%s",
        session_id,
        owner_id,
    )
    obj = crud.get_session(db, owner_id, session_id)
    if not obj:
        logger.warning("session.reopen: 404 session no encontrada session_id=%s owner_id=%s", session_id, owner_id)
        raise HTTPException(status_code=404, detail="Session no encontrada.")
    prev = (obj.approval_status or "").strip().lower()
    out = crud.reopen_session_to_draft(db, obj)
    logger.info(
        "session.reopen: ok session_id=%s approval_antes=%s approval_despues=%s",
        session_id,
        prev,
        (out.approval_status or "").strip().lower(),
    )
    return out


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
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return obj
    if (obj.approval_status or "").strip().lower() == "approved":
        raise HTTPException(
            status_code=409,
            detail="La sesión ya está aprobada y no se puede editar.",
        )
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

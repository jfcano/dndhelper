"""
Sub-rutas de campaña: outline (generar/aprobar), sesiones generadas y jugadores persistidos en brief.

Incluido desde `campaigns.router` para mantener `campaigns.py` más acotado.
"""

from __future__ import annotations

import json
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app import crud
from backend.app.api.campaign_helpers import (
    _coerce_session_summary_for_db,
    _ctx,
    _get_persisted_players,
    _set_persisted_players,
    _world_row_stmt,
)
from backend.app.db import get_db
from backend.app.deps_openai import require_openai_api_key_ctx
from backend.app.models import World
from backend.app.schemas import CampaignOut, SessionCreate, SessionOut
from backend.app.services import generation_service

router = APIRouter()

_OpenAIDep = Annotated[str, Depends(require_openai_api_key_ctx)]


@router.post("/{campaign_id}/outline:generate", response_model=CampaignOut)
def generate_outline_for_campaign(
    campaign_id: UUID,
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
) -> CampaignOut:
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar el outline.")
    if not campaign.world_id:
        raise HTTPException(status_code=400, detail="La campaign debe tener world_id antes de generar el outline.")

    stmt = _world_row_stmt(owner_id, campaign.world_id, adm)
    world = db.execute(stmt).scalars().first()
    if not world:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    if world.status != "approved" or not world.content_final:
        raise HTTPException(status_code=400, detail="El world debe estar aprobado antes de generar el outline.")

    world_payload = {
        "id": str(world.id),
        "name": world.name,
        "pitch": world.pitch,
        "tone": world.tone,
        "themes": world.themes,
        "content": world.content_final,
    }
    go = generation_service.generate_outline(brief=campaign.brief_final, world=world_payload)
    campaign.outline_draft = json.dumps(go.raw, ensure_ascii=False)
    campaign.outline_status = "draft"
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/sessions:generate", response_model=list[SessionOut])
def generate_sessions_for_campaign(
    campaign_id: UUID,
    _openai: _OpenAIDep,
    session_count: int = 3,
    db: Session = Depends(get_db),
) -> list[SessionOut]:
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")

    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar sesiones.")
    if not campaign.world_id:
        raise HTTPException(status_code=400, detail="La campaign debe tener world_id vinculado para generar sesiones.")

    story_text = campaign.story_final or campaign.story_draft
    if not story_text:
        raise HTTPException(status_code=400, detail="No hay story para generar sesiones.")

    if (campaign.outline_status or "").strip().lower() != "approved" or not (campaign.outline_final or "").strip():
        raise HTTPException(
            status_code=400,
            detail="El outline debe estar aprobado antes de generar sesiones.",
        )

    existing_sessions = crud.list_sessions_by_campaign(
        db, owner_id, campaign_id, limit=1000, offset=0, admin=adm
    )
    starting_session_number = max((s.session_number for s in existing_sessions), default=0) + 1

    sessions_raw = generation_service.generate_sessions(
        story_md=story_text,
        session_count=max(1, min(session_count, 20)),
        starting_session_number=starting_session_number,
    )

    created: list[SessionOut] = []
    for idx, s in enumerate(sessions_raw):
        session_number = starting_session_number + idx
        title = str(s.get("title") or f"Sesión {session_number}")
        summary_str = _coerce_session_summary_for_db(s.get("summary"))
        # Solo título + resumen al generar; el guion (`content_draft`) lo redacta el usuario en la UI.
        obj = crud.create_session(
            db,
            owner_id,
            campaign_id,
            SessionCreate(
                session_number=session_number,
                title=title,
                summary=summary_str or None,
                notes=None,
                status="planned",
            ),
            admin=adm,
        )
        created.append(obj)

    return created


@router.post("/{campaign_id}/players:generate")
def generate_players_for_campaign(
    campaign_id: UUID,
    _openai: _OpenAIDep,
    player_count: int = 4,
    db: Session = Depends(get_db),
) -> list[dict]:
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar jugadores.")

    generated = generation_service.generate_player_characters(
        brief=campaign.brief_final,
        player_count=max(1, min(player_count, 8)),
    )
    persisted = [
        {
            "id": str(uuid4()),
            "name": str(p.get("name") or "").strip() or "Jugador",
            "summary": str(p.get("summary") or "").strip(),
            "basic_sheet": p.get("basic_sheet"),
        }
        for p in generated
        if isinstance(p, dict)
    ]
    _set_persisted_players(campaign, persisted)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return persisted


@router.get("/{campaign_id}/players")
def list_players_for_campaign(campaign_id: UUID, db: Session = Depends(get_db)) -> list[dict]:
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    return _get_persisted_players(campaign)


@router.delete("/{campaign_id}/players/{player_id}")
def delete_player_for_campaign(campaign_id: UUID, player_id: str, db: Session = Depends(get_db)) -> list[dict]:
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")

    current = _get_persisted_players(campaign)
    updated = [p for p in current if str(p.get("id") or "") != str(player_id)]
    _set_persisted_players(campaign, updated)
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return updated


@router.patch("/{campaign_id}/outline", response_model=CampaignOut)
def patch_outline(campaign_id: UUID, payload: dict, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    campaign.outline_draft = json.dumps(payload, ensure_ascii=False)
    campaign.outline_status = "draft"
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/outline/approve", response_model=CampaignOut)
def approve_outline(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if not campaign.outline_draft:
        raise HTTPException(status_code=400, detail="No hay outline_draft para aprobar.")
    campaign.outline_final = campaign.outline_draft
    campaign.outline_status = "approved"
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign

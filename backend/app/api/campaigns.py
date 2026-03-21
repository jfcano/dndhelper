from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import json

from backend.app import crud
from backend.app.db import get_db
from backend.app.models import Campaign, Session as CampaignSession, World
from backend.app.owner_context import get_owner_id
from backend.app.schemas import (
    CampaignBrief,
    CampaignCreate,
    CampaignOut,
    CampaignUpdate,
    CampaignWizardAutogenerateRequest,
    CampaignStoryUpdate,
    SessionCreate,
    SessionOut,
)
from backend.app.deps_openai import require_openai_api_key_ctx
from backend.app.services import generation_service, world_image_service
from backend.app.world_names import is_world_name_taken
from sqlalchemy import func, select

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

_OpenAIDep = Annotated[str, Depends(require_openai_api_key_ctx)]

_PLAYERS_KEY = "__generated_players__"


def _get_persisted_players(campaign: Campaign) -> list[dict]:
    sources = [campaign.brief_draft, campaign.brief_final]
    for src in sources:
        if not isinstance(src, dict):
            continue
        players = src.get(_PLAYERS_KEY)
        if isinstance(players, list):
            return [p for p in players if isinstance(p, dict)]
    return []


def _set_persisted_players(campaign: Campaign, players: list[dict]) -> None:
    # Persistimos en brief_draft y, si existe, también en brief_final para campañas aprobadas.
    draft = dict(campaign.brief_draft) if isinstance(campaign.brief_draft, dict) else {}
    draft[_PLAYERS_KEY] = players
    campaign.brief_draft = draft

    if isinstance(campaign.brief_final, dict):
        final = dict(campaign.brief_final)
        final[_PLAYERS_KEY] = players
        campaign.brief_final = final


def _coerce_session_summary_for_db(raw: Any) -> str | None:
    """Normaliza el resumen de sesión devuelto por el LLM para guardarlo en BD (texto o JSON serializado)."""
    if raw is None:
        return None
    if isinstance(raw, str):
        t = raw.replace("\r\n", "\n").strip()
        return t if t else None
    if isinstance(raw, (dict, list)):
        try:
            t = json.dumps(raw, ensure_ascii=False)
            return t.strip() if t.strip() else None
        except (TypeError, ValueError):
            t = str(raw).strip()
            return t if t else None
    t = str(raw).strip()
    return t if t else None


@router.post("", response_model=CampaignOut)
def create(payload: CampaignCreate, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    return crud.create_campaign(db, owner_id, payload)


@router.get("", response_model=list[CampaignOut])
def list_(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)) -> list[CampaignOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    owner_id = get_owner_id()
    return crud.list_campaigns(db, owner_id, limit=limit, offset=offset)


@router.get("/{campaign_id}", response_model=CampaignOut)
def get(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    return obj


@router.patch("/{campaign_id}", response_model=CampaignOut)
def patch(campaign_id: UUID, payload: CampaignUpdate, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and obj.brief_status == "approved" and str(data["name"]).strip() != str(obj.name).strip():
        raise HTTPException(
            status_code=409,
            detail="No se puede cambiar el nombre de la campaña una vez aprobado el resumen inicial.",
        )
    return crud.update_campaign(db, obj, payload)


@router.delete("/{campaign_id}")
def delete(
    campaign_id: UUID,
    cascade: bool = Query(default=False, description="Eliminar la campaña y todas sus sesiones y datos asociados."),
    db: Session = Depends(get_db),
) -> dict:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")

    if not cascade:
        reasons: list[str] = []
        # Bloqueamos el borrado solo si existe contenido real en `brief_final`.
        # `brief_status` puede quedar inconsistente con datos históricos.
        if obj.brief_status == "approved" and obj.brief_final:
            reasons.append("brief aprobado")
        if obj.brief_status == "approved" and obj.story_final:
            reasons.append("resumen de historia aprobado")
        if obj.outline_draft or obj.outline_final:
            reasons.append("outline generado")

        sessions_count = int(
            db.execute(select(func.count(CampaignSession.id)).where(CampaignSession.campaign_id == campaign_id)).scalar_one()
            or 0
        )
        if sessions_count > 0:
            reasons.append(f"{sessions_count} sesión(es)")

        if reasons:
            raise HTTPException(
                status_code=409,
                detail=(
                    "No se puede borrar la campaign porque tiene contenido generado: "
                    + ", ".join(reasons)
                    + ". Usa ?cascade=true tras confirmar en el cliente."
                ),
            )

    crud.delete_campaign(db, obj)
    return {"ok": True}


def _run_set_brief_with_generation(campaign_id: UUID, payload: CampaignBrief, db: Session) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    obj.brief_draft = payload.model_dump()
    obj.brief_status = "draft"
    db.add(obj)
    db.commit()
    db.refresh(obj)

    # Tras finalizar el wizard, generamos automáticamente el resumen narrativo.
    if not obj.world_id:
        raise HTTPException(status_code=400, detail="La campaign debe tener world_id vinculado para generar el resumen.")

    stmt = select(World).where(World.id == obj.world_id, World.owner_id == owner_id)
    world = db.execute(stmt).scalars().first()
    if not world:
        raise HTTPException(status_code=404, detail="Mundo no encontrado (vinculado a la campaign).")

    world_payload = {
        "name": world.name,
        "tone": world.tone,
        "pitch": world.pitch,
        "content_final": world.content_final,
        "content_draft": world.content_draft,
        "status": world.status,
    }

    # Sugiere un nombre al generar el borrador narrativo (editable por el usuario).
    # Solo reemplazamos si el nombre está en el valor por defecto.
    if (obj.name or "").strip().lower() == "nueva campaña":
        obj.name = generation_service.suggest_campaign_name(brief=obj.brief_draft, world=world_payload)

    obj.story_draft = generation_service.generate_campaign_story_draft(brief=obj.brief_draft, world=world_payload)
    db.add(obj)
    db.commit()
    db.refresh(obj)

    return obj


@router.post("/{campaign_id}/brief", response_model=CampaignOut)
def set_brief(
    campaign_id: UUID,
    payload: CampaignBrief,
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
) -> CampaignOut:
    return _run_set_brief_with_generation(campaign_id, payload, db)


@router.post(":wizard/autogenerate")
def autogenerate_campaign_wizard_step(
    payload: CampaignWizardAutogenerateRequest,
    _openai: _OpenAIDep,
) -> dict:
    patch = generation_service.autogenerate_campaign_wizard_step(
        step=payload.step,
        wizard=payload.wizard.model_dump(),
    )
    return {"step": payload.step, "patch": patch}


@router.patch("/{campaign_id}/brief", response_model=CampaignOut)
def patch_brief(
    campaign_id: UUID,
    payload: CampaignBrief,
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
) -> CampaignOut:
    # Reutilizamos el mismo schema; en MVP se envía completo.
    return _run_set_brief_with_generation(campaign_id, payload, db)


@router.post("/{campaign_id}/brief/approve", response_model=CampaignOut)
def approve_brief(
    campaign_id: UUID,
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if not obj.brief_draft:
        raise HTTPException(status_code=400, detail="No hay brief_draft para aprobar.")

    if not obj.world_id:
        raise HTTPException(status_code=400, detail="La campaign debe tener world_id vinculado para aprobar el resumen.")

    # Aseguramos que exista story_draft antes de aprobar.
    if not obj.story_draft:
        if not obj.world_id:
            raise HTTPException(status_code=400, detail="La campaign debe tener world_id vinculado para aprobar el resumen.")
        stmt = select(World).where(World.id == obj.world_id, World.owner_id == owner_id)
        world = db.execute(stmt).scalars().first()
        if not world:
            raise HTTPException(status_code=404, detail="Mundo no encontrado (vinculado a la campaign).")
        world_payload = {
            "name": world.name,
            "tone": world.tone,
            "pitch": world.pitch,
            "content_final": world.content_final,
            "content_draft": world.content_draft,
            "status": world.status,
        }

        # Si el story_draft aún no existe, sugerimos también un nombre al generarlo.
        # Solo reemplazamos si el nombre está en el valor por defecto.
        if (obj.name or "").strip().lower() == "nueva campaña":
            obj.name = generation_service.suggest_campaign_name(brief=obj.brief_draft, world=world_payload)

        obj.story_draft = generation_service.generate_campaign_story_draft(brief=obj.brief_draft, world=world_payload)

    obj.brief_final = obj.brief_draft
    obj.brief_status = "approved"
    obj.story_final = obj.story_draft
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{campaign_id}/reopen", response_model=CampaignOut)
def reopen_campaign(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")

    # Volver a borrador mantiene el contenido final como base editable.
    if obj.brief_final:
        obj.brief_draft = obj.brief_final
    obj.brief_status = "draft"

    if obj.story_final:
        obj.story_draft = obj.story_final

    if obj.outline_final:
        obj.outline_draft = obj.outline_final
    elif obj.outline_draft:
        # Si hay outline_draft previo, también se considera borrador al reabrir campaña.
        obj.outline_draft = obj.outline_draft
    obj.outline_status = "draft"

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.patch("/{campaign_id}/story", response_model=CampaignOut)
def patch_story(campaign_id: UUID, payload: CampaignStoryUpdate, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if obj.brief_status == "approved":
        raise HTTPException(status_code=409, detail="No se puede editar el resumen de historia mientras está aprobado. Reabrir a borrador primero.")
    if not obj.world_id:
        raise HTTPException(status_code=400, detail="La campaign debe tener world_id vinculado para editar el resumen de historia.")
    obj.story_draft = payload.story_draft
    if payload.story_draft is None:
        obj.story_final = None
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{campaign_id}/story/reset", response_model=CampaignOut)
def reset_campaign_story(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id = get_owner_id()
    obj = crud.get_campaign(db, owner_id, campaign_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if obj.brief_status == "approved":
        raise HTTPException(status_code=409, detail="No se puede resetear el resumen de historia mientras está aprobado. Reabrir a borrador primero.")
    obj.story_draft = None
    obj.story_final = None
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{campaign_id}/world:generate", response_model=CampaignOut)
def generate_world_for_campaign(
    campaign_id: UUID,
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
) -> CampaignOut:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar el mundo.")

    gw = generation_service.generate_world(brief=campaign.brief_final)
    if is_world_name_taken(db, owner_id, gw.name):
        raise HTTPException(
            status_code=409,
            detail=(
                f"El nombre de mundo generado «{gw.name}» ya está en uso. "
                "Renombra el mundo existente o vuelve a generar el mundo de la campaña tras ajustar el brief."
            ),
        )
    draft_dict = gw.draft if isinstance(gw.draft, dict) else {}
    world = World(
        owner_id=owner_id,
        name=gw.name,
        pitch=gw.pitch,
        tone=gw.tone,
        themes=gw.themes,
        content_draft=json.dumps(gw.draft, ensure_ascii=False),
        visual_assets=world_image_service.build_brief_visual_slots(
            draft=draft_dict,
            world_name=gw.name,
            pitch=gw.pitch,
            tone=gw.tone,
        ),
        status="draft",
    )
    db.add(world)
    db.commit()
    db.refresh(world)

    campaign.world_id = world.id
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.post("/{campaign_id}/outline:generate", response_model=CampaignOut)
def generate_outline_for_campaign(
    campaign_id: UUID,
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
) -> CampaignOut:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar el outline.")
    if not campaign.world_id:
        raise HTTPException(status_code=400, detail="La campaign debe tener world_id antes de generar el outline.")

    stmt = select(World).where(World.id == campaign.world_id, World.owner_id == owner_id)
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
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
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

    existing_sessions = crud.list_sessions_by_campaign(db, owner_id, campaign_id, limit=1000, offset=0)
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
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
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
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    return _get_persisted_players(campaign)


@router.delete("/{campaign_id}/players/{player_id}")
def delete_player_for_campaign(campaign_id: UUID, player_id: str, db: Session = Depends(get_db)) -> list[dict]:
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
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
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
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
    owner_id = get_owner_id()
    campaign = crud.get_campaign(db, owner_id, campaign_id)
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


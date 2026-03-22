from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import json

from backend.app import crud
from backend.app.db import get_db
from backend.app.models import Campaign, Session as CampaignSession, World
from backend.app.schemas import (
    CampaignBrief,
    CampaignCreate,
    CampaignOut,
    CampaignUpdate,
    CampaignWizardAutogenerateRequest,
    CampaignStoryUpdate,
)
from backend.app.api.campaign_helpers import _ctx, _world_row_stmt
from backend.app.api.campaign_routes_outline_sessions import router as _campaign_outline_sessions_router
from backend.app.deps_openai import require_openai_api_key_ctx
from backend.app.services import generation_service, world_image_service
from backend.app.world_names import is_world_name_taken
from sqlalchemy import func, select

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

_OpenAIDep = Annotated[str, Depends(require_openai_api_key_ctx)]


@router.post("", response_model=CampaignOut)
def create(payload: CampaignCreate, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id, adm = _ctx()
    return crud.create_campaign(db, owner_id, payload)


@router.get("", response_model=list[CampaignOut])
def list_(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)) -> list[CampaignOut]:
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    owner_id, adm = _ctx()
    return crud.list_campaigns(db, owner_id, limit=limit, offset=offset, admin=adm)


@router.get("/{campaign_id}", response_model=CampaignOut)
def get(campaign_id: UUID, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not obj:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    return obj


@router.patch("/{campaign_id}", response_model=CampaignOut)
def patch(campaign_id: UUID, payload: CampaignUpdate, db: Session = Depends(get_db)) -> CampaignOut:
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
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
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
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
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
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

    stmt = _world_row_stmt(owner_id, obj.world_id, adm)
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
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
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
        stmt = _world_row_stmt(owner_id, obj.world_id, adm)
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
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
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
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
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
    owner_id, adm = _ctx()
    obj = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
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
    owner_id, adm = _ctx()
    campaign = crud.get_campaign(db, owner_id, campaign_id, admin=adm)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign no encontrada.")
    if campaign.brief_status != "approved" or not campaign.brief_final:
        raise HTTPException(status_code=400, detail="El brief debe estar aprobado antes de generar el mundo.")

    gw = generation_service.generate_world(brief=campaign.brief_final)
    wowner = campaign.owner_id
    if is_world_name_taken(db, wowner, gw.name):
        raise HTTPException(
            status_code=409,
            detail=(
                f"El nombre de mundo generado «{gw.name}» ya está en uso. "
                "Renombra el mundo existente o vuelve a generar el mundo de la campaña tras ajustar el brief."
            ),
        )
    draft_dict = gw.draft if isinstance(gw.draft, dict) else {}
    world = World(
        owner_id=wowner,
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


router.include_router(_campaign_outline_sessions_router)


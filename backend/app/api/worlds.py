from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.app.db import get_db
from backend.app.models import Campaign, World
from backend.app.owner_context import get_owner_id
from backend.app.schemas import (
    CampaignOut,
    WorldCreate,
    WorldGenerate,
    WorldOut,
    WorldUpdate,
    WorldVisualGenerateRequest,
    WorldWizardAutogenerateRequest,
)
from backend.app.services import generation_service, world_image_service
from backend.app.world_names import is_world_name_taken

_SAFE_IMAGE_FILE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._-]*\.png$")

router = APIRouter(prefix="/worlds", tags=["worlds"])


@router.post("", response_model=WorldOut)
def create_world(payload: WorldCreate, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    if is_world_name_taken(db, owner_id, payload.name):
        raise HTTPException(
            status_code=409,
            detail="Ya existe un mundo con ese nombre. Elige otro.",
        )
    obj = World(owner_id=owner_id, name=payload.name)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post(":generate", response_model=WorldOut)
def generate_world(payload: WorldGenerate, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    faction_names = {f.name.strip().lower() for f in payload.factions}
    missing = sorted(
        {
            c.faction_name.strip()
            for c in payload.characters
            if c.faction_name.strip().lower() not in faction_names
        }
    )
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Hay personajes con facción no definida en el paso de facciones: {', '.join(missing)}",
        )

    gw = generation_service.generate_world_from_wizard(
        theme_and_mood=payload.theme_and_mood,
        factions=[f.model_dump() for f in payload.factions],
        characters=[c.model_dump() for c in payload.characters],
        cities=[c.model_dump() for c in payload.cities],
    )
    if is_world_name_taken(db, owner_id, gw.name):
        raise HTTPException(
            status_code=409,
            detail=(
                f"El nombre de mundo generado «{gw.name}» ya está en uso. "
                "Renombra el otro mundo, ajústalo en el contenido, o modifica la entrada del asistente y vuelve a generar."
            ),
        )
    obj = World(
        owner_id=owner_id,
        name=gw.name,
        pitch=gw.pitch,
        tone=gw.tone,
        themes=gw.themes,
        content_draft=gw.content_draft,
        visual_assets=world_image_service.build_wizard_visual_slots(
            theme_and_mood=payload.theme_and_mood,
            factions=[f.model_dump() for f in payload.factions],
            characters=[c.model_dump() for c in payload.characters],
            cities=[c.model_dump() for c in payload.cities],
            world_name=gw.name,
            pitch=gw.pitch,
            tone=gw.tone,
            content_snippet=(gw.content_draft or "")[:2000],
        ),
        status="draft",
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{world_id}/generate", response_model=WorldOut)
def generate_world_for_existing_world(
    world_id: UUID,
    payload: WorldGenerate,
    db: Session = Depends(get_db),
) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")

    faction_names = {f.name.strip().lower() for f in payload.factions}
    missing = sorted(
        {
            c.faction_name.strip()
            for c in payload.characters
            if c.faction_name.strip().lower() not in faction_names
        }
    )
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Hay personajes con facción no definida en el paso de facciones: {', '.join(missing)}",
        )

    gw = generation_service.generate_world_from_wizard(
        theme_and_mood=payload.theme_and_mood,
        factions=[f.model_dump() for f in payload.factions],
        characters=[c.model_dump() for c in payload.characters],
        cities=[c.model_dump() for c in payload.cities],
    )

    if is_world_name_taken(db, owner_id, gw.name, exclude_world_id=world_id):
        raise HTTPException(
            status_code=409,
            detail=(
                f"El nombre de mundo generado «{gw.name}» ya lo usa otro mundo tuyo. "
                "Renombra ese mundo o ajusta el asistente y vuelve a generar."
            ),
        )

    # Actualizamos el mundo existente y dejamos un borrador para que el usuario pueda revisarlo.
    obj.name = gw.name
    obj.pitch = gw.pitch
    obj.tone = gw.tone
    obj.themes = gw.themes
    obj.content_draft = gw.content_draft
    obj.content_final = None
    obj.status = "draft"
    world_image_service.clear_world_images_dir(world_id)
    obj.visual_assets = world_image_service.build_wizard_visual_slots(
        theme_and_mood=payload.theme_and_mood,
        factions=[f.model_dump() for f in payload.factions],
        characters=[c.model_dump() for c in payload.characters],
        cities=[c.model_dump() for c in payload.cities],
        world_name=gw.name,
        pitch=gw.pitch,
        tone=gw.tone,
        content_snippet=(gw.content_draft or "")[:2000],
    )

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{world_id}/visual:generate", response_model=WorldOut)
def generate_one_world_visual(
    world_id: UUID,
    payload: WorldVisualGenerateRequest,
    db: Session = Depends(get_db),
) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    assets = obj.visual_assets if isinstance(obj.visual_assets, dict) else {}
    idx = payload.index if payload.target != "world_map" else 0
    new_assets, ok, err = world_image_service.apply_slot_generation(
        world_id,
        assets,
        payload.target,
        idx,
    )
    obj.visual_assets = new_assets
    # Asegurar marca temporal distinta en la respuesta (cliente bustea URLs de PNG).
    obj.updated_at = datetime.now(timezone.utc)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    if not ok:
        raise HTTPException(status_code=502, detail=err or "No se pudo generar la imagen.")
    return obj


@router.post(":wizard/autogenerate")
def autogenerate_world_wizard_step(payload: WorldWizardAutogenerateRequest) -> dict:
    patch = generation_service.autogenerate_world_wizard_step(
        step=payload.step,
        wizard=payload.wizard.model_dump(),
    )
    return {"step": payload.step, "patch": patch}


@router.get("", response_model=list[WorldOut])
def list_worlds(limit: int = 50, offset: int = 0, db: Session = Depends(get_db)) -> list[WorldOut]:
    owner_id = get_owner_id()
    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    stmt = select(World).where(World.owner_id == owner_id).order_by(World.created_at.desc()).limit(limit).offset(offset)
    return list(db.execute(stmt).scalars().all())


@router.get("/{world_id}/image/{filename}")
def get_world_image(world_id: UUID, filename: str, db: Session = Depends(get_db)) -> FileResponse:
    owner_id = get_owner_id()
    if not _SAFE_IMAGE_FILE.match(filename):
        raise HTTPException(status_code=400, detail="Nombre de imagen no válido.")
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    base = world_image_service.world_images_dir(world_id).resolve()
    target = (world_image_service.world_images_dir(world_id) / filename).resolve()
    try:
        target.relative_to(base)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Ruta fuera del directorio del mundo.") from e
    if not target.is_file():
        raise HTTPException(status_code=404, detail="Imagen no encontrada.")
    # Misma ruta de archivo al regenerar → sin esto los navegadores suelen cachear la PNG antigua.
    return FileResponse(
        target,
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=0, must-revalidate"},
    )


@router.get("/{world_id}", response_model=WorldOut)
def get_world(world_id: UUID, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    return obj


@router.get("/{world_id}/usage")
def get_world_usage(world_id: UUID, db: Session = Depends(get_db)) -> dict:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")

    usage_stmt = select(func.count(Campaign.id)).where(
        Campaign.owner_id == owner_id,
        Campaign.world_id == world_id,
    )
    campaign_count = int(db.execute(usage_stmt).scalar_one() or 0)
    return {"campaign_count": campaign_count}


@router.get("/{world_id}/campaigns", response_model=list[CampaignOut])
def list_campaigns_for_world(
    world_id: UUID, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)
) -> list[CampaignOut]:
    owner_id = get_owner_id()

    world_stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    world_obj = db.execute(world_stmt).scalars().first()
    if not world_obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    stmt = (
        select(Campaign)
        .where(Campaign.owner_id == owner_id, Campaign.world_id == world_id)
        .order_by(Campaign.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.execute(stmt).scalars().all())


@router.patch("/{world_id}", response_model=WorldOut)
def patch_world(world_id: UUID, payload: WorldUpdate, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    data = payload.model_dump(exclude_unset=True)
    new_name = data.get("name")
    if new_name is not None and is_world_name_taken(db, owner_id, str(new_name), exclude_world_id=world_id):
        raise HTTPException(
            status_code=409,
            detail="Ya existe otro mundo con ese nombre.",
        )
    for k, v in data.items():
        setattr(obj, k, v)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{world_id}/approve", response_model=WorldOut)
def approve_world(world_id: UUID, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    obj.content_final = obj.content_draft
    obj.status = "approved"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{world_id}/reopen", response_model=WorldOut)
def reopen_world(world_id: UUID, db: Session = Depends(get_db)) -> WorldOut:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")
    # Al reabrir, usamos el contenido final como nueva base editable.
    if obj.content_final is not None:
        obj.content_draft = obj.content_final
    obj.status = "draft"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{world_id}")
def delete_world(
    world_id: UUID,
    cascade: bool = Query(
        default=False,
        description="Eliminar también todas las campañas vinculadas a este mundo (y sus sesiones).",
    ),
    db: Session = Depends(get_db),
) -> dict:
    owner_id = get_owner_id()
    stmt = select(World).where(World.id == world_id, World.owner_id == owner_id)
    obj = db.execute(stmt).scalars().first()
    if not obj:
        raise HTTPException(status_code=404, detail="World no encontrado.")

    usage_stmt = select(func.count(Campaign.id)).where(
        Campaign.owner_id == owner_id,
        Campaign.world_id == world_id,
    )
    campaign_count = int(db.execute(usage_stmt).scalar_one() or 0)
    if campaign_count > 0 and not cascade:
        raise HTTPException(
            status_code=409,
            detail=(
                f"No se puede borrar el world porque está siendo usado por {campaign_count} campaign(s). "
                "Usa ?cascade=true tras confirmar en el cliente para eliminarlas también."
            ),
        )

    if campaign_count > 0 and cascade:
        camp_stmt = select(Campaign).where(Campaign.owner_id == owner_id, Campaign.world_id == world_id)
        for camp in db.execute(camp_stmt).scalars().all():
            db.delete(camp)
        db.flush()

    world_image_service.clear_world_images_dir(world_id)
    db.delete(obj)
    db.commit()
    return {"ok": True}


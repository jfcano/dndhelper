from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any
from uuid import UUID

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.crud import get_campaign, list_sessions_by_campaign
from backend.app.models import Campaign, Session as CampaignSession, World
from backend.app.openai_key_runtime import bind_request_openai_api_key, reset_request_openai_api_key, resolve_openai_api_key_for_owner
from backend.app.rag_collection import rag_campaign_refs_collection_for_owner
from backend.app.vector_store import get_vector_store

logger = logging.getLogger(__name__)

_MANIFEST_NAME = "campaign_rag_meta.json"


def _manifest_path() -> Path:
    settings = get_settings()
    d = settings.project_root / "backend" / "storage"
    d.mkdir(parents=True, exist_ok=True)
    return d / _MANIFEST_NAME


def _load_manifest() -> dict[str, Any]:
    p = _manifest_path()
    if not p.exists():
        return {"campaigns": {}}
    return json.loads(p.read_text(encoding="utf-8"))


def _save_manifest(data: dict[str, Any]) -> None:
    _manifest_path().write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _json_dump(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, indent=2)
    except (TypeError, ValueError):
        return str(obj)


def build_campaign_snapshot_text(
    *,
    campaign: Campaign,
    world: World | None,
    sessions: list[CampaignSession],
) -> str:
    """Texto plano con el contenido relevante de la campaña para contexto o indexación."""
    parts: list[str] = []
    parts.append(f"# Campaña: {campaign.name}\n")
    parts.append(f"Sistema: {campaign.system}")
    if campaign.tone:
        parts.append(f"Tono: {campaign.tone}")
    if campaign.starting_level is not None:
        parts.append(f"Nivel inicial: {campaign.starting_level}")
    if campaign.goals:
        parts.append(f"Objetivos / notas: {campaign.goals}")

    if world:
        parts.append("\n## Mundo vinculado\n")
        parts.append(f"Nombre: {world.name}")
        if world.pitch:
            parts.append(f"Pitch: {world.pitch}")
        wc = (world.content_final or world.content_draft or "").strip()
        if wc:
            parts.append(f"Contenido del mundo:\n{wc[:50_000]}")

    if campaign.brief_draft:
        parts.append("\n## Brief (borrador)\n")
        parts.append(_json_dump(campaign.brief_draft))
    if campaign.brief_final:
        parts.append("\n## Brief (aprobado)\n")
        parts.append(_json_dump(campaign.brief_final))

    story = (campaign.story_final or campaign.story_draft or "").strip()
    if story:
        parts.append("\n## Historia / guion de campaña\n")
        parts.append(story[:80_000])

    outline_raw = (campaign.outline_final or campaign.outline_draft or "").strip()
    if outline_raw:
        parts.append("\n## Outline\n")
        if outline_raw.startswith("{") or outline_raw.startswith("["):
            parts.append(outline_raw[:80_000])
        else:
            parts.append(outline_raw[:80_000])

    if sessions:
        parts.append("\n## Sesiones\n")
        for s in sessions:
            parts.append(f"### Sesión {s.session_number}: {s.title}\n")
            if s.summary:
                parts.append(f"Resumen: {s.summary}\n")
            body = (s.content_final or s.content_draft or "").strip()
            if body:
                parts.append(body[:40_000])
            if s.notes:
                parts.append(f"Notas: {s.notes}\n")

    return "\n\n".join(parts)


def _snapshot_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def sync_campaign_to_rag_index(
    db: Session,
    owner_id: UUID,
    campaign_id: UUID,
    *,
    admin: bool = False,
) -> bool:
    """
    Actualiza embeddings de la campaña en la colección «referencias de campaña».
    Devuelve True si se indexó (o se omitió por hash igual), False si hubo error recuperable.
    """
    campaign = get_campaign(db, owner_id, campaign_id, admin=admin)
    if not campaign:
        logger.warning("sync_campaign_to_rag_index: campaña %s no encontrada.", campaign_id)
        return False

    rag_owner = campaign.owner_id
    settings = get_settings()
    key = resolve_openai_api_key_for_owner(db, rag_owner)
    if not key:
        logger.warning("sync_campaign_to_rag_index: sin clave OpenAI para el propietario.")
        return False

    world: World | None = None
    if campaign.world_id:
        world = db.get(World, campaign.world_id)

    try:
        sessions = list_sessions_by_campaign(
            db, campaign.owner_id, campaign_id, limit=2000, offset=0, admin=admin
        )
    except LookupError:
        return False

    snapshot = build_campaign_snapshot_text(campaign=campaign, world=world, sessions=sessions)
    h = _snapshot_hash(snapshot)
    manifest = _load_manifest()
    campaigns = manifest.setdefault("campaigns", {})
    cid_key = str(campaign_id)
    prev = campaigns.get(cid_key)
    if isinstance(prev, dict) and prev.get("hash") == h:
        return True

    coll_name = rag_campaign_refs_collection_for_owner(rag_owner)
    old_chunks = int((prev or {}).get("chunks", 0) or 0) if isinstance(prev, dict) else 0

    tok = bind_request_openai_api_key(key)
    try:
        vs = get_vector_store(collection_name=coll_name)
        if old_chunks > 0:
            old_ids = [f"crag-{campaign_id.hex}-{i}" for i in range(old_chunks)]
            try:
                vs.delete(ids=old_ids, collection_only=True)
            except Exception:
                logger.exception("sync_campaign_to_rag_index: borrado de chunks antiguos falló; se reindexa encima.")

        if not snapshot.strip():
            campaigns[cid_key] = {"hash": h, "chunks": 0}
            _save_manifest(manifest)
            return True

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
        meta_base = {
            "source": f"campaign:{campaign_id}",
            "campaign_id": cid_key,
            "page": 1,
        }
        doc = Document(page_content=snapshot, metadata=dict(meta_base))
        chunks = splitter.split_documents([doc])
        valid: list[Document] = []
        for d in chunks:
            t = str(getattr(d, "page_content", "") or "").strip()
            if not t:
                continue
            d.metadata = dict(meta_base)
            valid.append(d)

        if not valid:
            campaigns[cid_key] = {"hash": h, "chunks": 0}
            _save_manifest(manifest)
            return True

        ids = [f"crag-{campaign_id.hex}-{i}" for i in range(len(valid))]
        for i, d in enumerate(valid):
            d.metadata["page"] = i + 1
        vs.add_documents(valid, ids=ids)
        campaigns[cid_key] = {"hash": h, "chunks": len(valid)}
        _save_manifest(manifest)
        logger.info(
            "sync_campaign_to_rag_index: campaña %s indexada (%d chunks, colección=%s).",
            campaign_id,
            len(valid),
            coll_name,
        )
    finally:
        reset_request_openai_api_key(tok)

    return True


def sync_all_campaigns_for_owner(
    db: Session,
    owner_id: UUID,
    *,
    admin: bool = False,
) -> None:
    """Indexa todas las campañas accesibles del usuario (para consultas «campañas en general»)."""
    from sqlalchemy import select

    stmt = select(Campaign.id).order_by(Campaign.created_at.desc())
    if not admin:
        stmt = stmt.where(Campaign.owner_id == owner_id)
    ids = [row[0] for row in db.execute(stmt).all()]
    for cid in ids:
        sync_campaign_to_rag_index(db, owner_id, cid, admin=admin)


def clear_campaign_sync_manifest_for_owner(db: Session, owner_id: UUID) -> int:
    """Quita entradas del manifiesto de reindexado por campaña para todas las campañas del usuario."""
    from sqlalchemy import select

    stmt = select(Campaign.id).where(Campaign.owner_id == owner_id)
    ids = [str(row[0]) for row in db.execute(stmt).all()]
    manifest = _load_manifest()
    campaigns = manifest.setdefault("campaigns", {})
    n = 0
    for cid in ids:
        if cid in campaigns:
            del campaigns[cid]
            n += 1
    if n:
        _save_manifest(manifest)
    return n

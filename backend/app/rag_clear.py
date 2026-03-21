from __future__ import annotations

import logging
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.campaign_rag_sync import clear_campaign_sync_manifest_for_owner
from backend.app.ingest import remove_manifest_entries_for_collection
from backend.app.ingest_job_repo import remove_ingest_job_and_pdf
from backend.app.models import IngestJob
from backend.app.rag_collection import rag_campaign_refs_collection_for_owner, rag_manuals_collection_for_owner
from backend.app.vector_store import get_vector_store

logger = logging.getLogger(__name__)

TargetKind = Literal["manuals", "campaign"]


def _job_rag_target(
    job: IngestJob,
    manuals_coll: str,
    campaign_coll: str,
) -> TargetKind | None:
    cn = (job.collection_name or "").strip()
    if not cn:
        return "manuals"
    if cn == manuals_coll:
        return "manuals"
    if cn == campaign_coll:
        return "campaign"
    legacy = f"rag_u_{job.owner_id.hex}"
    if cn == legacy:
        return "manuals"
    return None


def _drop_collection(collection_name: str) -> bool:
    try:
        vs = get_vector_store(collection_name=collection_name)
        vs.delete_collection()
        logger.info("rag_clear: colección PGVector eliminada: %s", collection_name)
        return True
    except Exception as e:
        logger.warning("rag_clear: no se pudo eliminar la colección %s: %s", collection_name, e)
        return False


def clear_owner_rag_targets(
    db: Session,
    owner_id: UUID,
    *,
    targets: list[TargetKind],
) -> dict[str, object]:
    """
    Borra colecciones vectoriales indicadas, trabajos de ingesta asociados (y ficheros en disco),
    y limpia manifiestos locales. ``targets`` sin duplicados lógicos.
    """
    want: set[TargetKind] = set()
    for t in targets:
        if t in ("manuals", "campaign"):
            want.add(t)
    if not want:
        raise ValueError("Indica al menos un destino: manuals o campaign.")

    manuals_coll = rag_manuals_collection_for_owner(owner_id)
    campaign_coll = rag_campaign_refs_collection_for_owner(owner_id)

    stmt = select(IngestJob).where(IngestJob.owner_id == owner_id).order_by(IngestJob.created_at.asc())
    jobs = list(db.execute(stmt).scalars().all())

    removed_jobs = 0
    for job in jobs:
        jt = _job_rag_target(job, manuals_coll, campaign_coll)
        if jt is None or jt not in want:
            continue
        remove_ingest_job_and_pdf(db, job)
        removed_jobs += 1

    dropped: list[str] = []
    manifest_ingest = 0
    campaign_meta = 0

    if "manuals" in want:
        _drop_collection(manuals_coll)
        dropped.append(manuals_coll)
        manifest_ingest += remove_manifest_entries_for_collection(collection_name=manuals_coll)

    if "campaign" in want:
        _drop_collection(campaign_coll)
        dropped.append(campaign_coll)
        manifest_ingest += remove_manifest_entries_for_collection(collection_name=campaign_coll)
        campaign_meta = clear_campaign_sync_manifest_for_owner(db, owner_id)

    return {
        "targets_cleared": sorted(want, key=lambda x: (x != "manuals", x)),
        "ingest_jobs_removed": removed_jobs,
        "manifest_ingest_keys_removed": manifest_ingest,
        "campaign_manifest_entries_removed": campaign_meta,
        "collections_dropped": dropped,
    }

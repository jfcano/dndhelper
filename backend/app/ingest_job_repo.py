from __future__ import annotations

import logging
import uuid
from pathlib import Path

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from backend.app.models import IngestJob
from backend.app.rag_collection import rag_manuals_collection_for_owner

logger = logging.getLogger(__name__)


def _safe_unlink_pdf(stored_path: str | None) -> None:
    if not stored_path:
        return
    try:
        p = Path(stored_path)
        if p.is_file():
            p.unlink()
    except OSError as e:
        logger.warning("No se pudo borrar el PDF en disco %s: %s", stored_path, e)


def get_ingest_job_for_owner(
    db: Session, owner_id: uuid.UUID, job_id: uuid.UUID, *, admin: bool = False
) -> IngestJob | None:
    job = db.get(IngestJob, job_id)
    if job is None:
        return None
    if not admin and job.owner_id != owner_id:
        return None
    return job


def remove_ingest_job_and_pdf(db: Session, job: IngestJob) -> None:
    path = job.stored_path
    db.delete(job)
    db.commit()
    _safe_unlink_pdf(path)


def create_job(
    db: Session,
    *,
    job_id: uuid.UUID,
    owner_id: uuid.UUID,
    original_filename: str,
    stored_path: str,
    target_collection_name: str | None = None,
) -> IngestJob:
    coll = target_collection_name or rag_manuals_collection_for_owner(owner_id)
    row = IngestJob(
        id=job_id,
        owner_id=owner_id,
        original_filename=original_filename,
        stored_path=stored_path,
        status="queued",
        progress_percent=0,
        phase_label="En cola",
        collection_name=coll,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def requeue_interrupted_processing_jobs(db: Session) -> int:
    """
    Pasa de «processing» a «queued» los trabajos que quedaron a medias (caída del worker, etc.).

    Debe ejecutarse al **arrancar** el worker de ingesta. Está pensado para **un único** worker;
    con varios procesos reclamando la cola, no conviene llamar a esto mientras otro worker siga vivo.
    """
    res = db.execute(
        update(IngestJob)
        .where(IngestJob.status == "processing")
        .values(
            status="queued",
            progress_percent=0,
            phase_label="En cola (reencolado tras interrupción)",
            updated_at=func.now(),
        )
    )
    db.commit()
    return int(res.rowcount or 0)


def list_jobs_for_owner(db: Session, owner_id: uuid.UUID, *, limit: int = 100, admin: bool = False) -> list[IngestJob]:
    stmt = select(IngestJob).order_by(IngestJob.created_at.desc()).limit(limit)
    if not admin:
        stmt = stmt.where(IngestJob.owner_id == owner_id)
    return list(db.execute(stmt).scalars().all())


def claim_next_queued_job(db: Session) -> uuid.UUID | None:
    stmt = (
        select(IngestJob)
        .where(IngestJob.status == "queued")
        .order_by(IngestJob.created_at.asc())
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    job = db.execute(stmt).scalar_one_or_none()
    if job is None:
        db.rollback()
        return None
    job.status = "processing"
    job.progress_percent = 0
    job.phase_label = "Iniciando…"
    db.commit()
    return job.id


def update_job_progress(db: Session, job_id: uuid.UUID, percent: int, phase_label: str | None) -> None:
    job = db.get(IngestJob, job_id)
    if not job or job.status == "cancelled":
        return
    job.progress_percent = max(0, min(100, percent))
    if phase_label is not None:
        job.phase_label = phase_label
    db.commit()


def finalize_job_success(
    db: Session,
    job_id: uuid.UUID,
    *,
    skipped_duplicate: bool,
    chunks_indexed: int,
    pdf_sha256: str,
    collection: str,
) -> None:
    job = db.get(IngestJob, job_id)
    if not job or job.status == "cancelled":
        return
    job.status = "done"
    job.progress_percent = 100
    job.pdf_sha256 = pdf_sha256
    job.collection_name = collection
    job.chunks_indexed = chunks_indexed
    if skipped_duplicate:
        job.outcome = "unchanged"
        job.message = "Este documento ya estaba indexado (mismo contenido)."
        job.phase_label = "Completado"
    elif chunks_indexed == 0:
        job.outcome = "empty"
        job.message = "El PDF no generó fragmentos indexables (¿vacío o sin texto seleccionable?)."
        job.phase_label = "Completado"
    else:
        job.outcome = "indexed"
        job.message = (
            f"Documento indexado: {chunks_indexed} fragmento(s) en la colección «{collection}»."
        )
        job.phase_label = "Completado"
    job.error_detail = None
    db.commit()


def finalize_job_failed(db: Session, job_id: uuid.UUID, error_detail: str, *, phase_label: str | None = None) -> None:
    job = db.get(IngestJob, job_id)
    if not job or job.status == "cancelled":
        return
    job.status = "failed"
    job.phase_label = phase_label or "Error"
    job.error_detail = error_detail[:8000] if error_detail else None
    db.commit()

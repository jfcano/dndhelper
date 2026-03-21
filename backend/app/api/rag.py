from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.config import get_settings
from backend.app.db import get_db
from backend.app.deps_openai import require_openai_api_key_ctx
from backend.app.ingest_job_repo import (
    create_job,
    get_ingest_job_for_owner,
    list_jobs_for_owner,
    remove_ingest_job_and_pdf,
)
from backend.app.owner_context import get_owner_id
from backend.app.schemas import IngestJobDeleteResponse, IngestJobOut, PdfEnqueueResponse
from backend.app.services.rag_service import answer_question

logger = logging.getLogger(__name__)

router = APIRouter()

_OpenAIDep = Annotated[str, Depends(require_openai_api_key_ctx)]

_MAX_PDF_BYTES = 50 * 1024 * 1024


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]


def _safe_pdf_filename(name: str | None) -> str:
    if not name or not str(name).strip():
        return "manual.pdf"
    base = Path(str(name)).name
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    if not base.lower().endswith(".pdf"):
        base = f"{base}.pdf"
    return base[:180] if len(base) > 180 else base


@router.post("/query_rules", response_model=QueryResponse)
def query_rules(payload: QueryRequest, _openai: _OpenAIDep) -> QueryResponse:
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    try:
        result = answer_question(question)
        return QueryResponse(answer=result["answer"], sources=result["sources"])
    except Exception as e:
        logger.exception("query_rules: error procesando pregunta: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/ingest_jobs", response_model=list[IngestJobOut])
def list_ingest_jobs(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[IngestJobOut]:
    owner_id = get_owner_id()
    rows = list_jobs_for_owner(db, owner_id, limit=limit)
    return [IngestJobOut.model_validate(r) for r in rows]


@router.delete("/ingest_jobs/{job_id}", response_model=IngestJobDeleteResponse)
def delete_or_cancel_ingest_job(job_id: UUID, db: Session = Depends(get_db)) -> IngestJobDeleteResponse:
    """
    - Si el trabajo está «processing»: marca «cancelled»; el worker borra fila y PDF al detenerse.
    - En cualquier otro estado: borra la fila y el fichero subido.
    """
    owner_id = get_owner_id()
    job = get_ingest_job_for_owner(db, owner_id, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado.")
    if job.status == "processing":
        job.status = "cancelled"
        job.phase_label = "Cancelación solicitada; el worker detendrá el proceso en breve."
        job.message = "Puedes cerrar esta vista; el PDF se eliminará al cancelarse."
        db.commit()
        return IngestJobDeleteResponse(action="cancel_requested", job_id=job_id)
    remove_ingest_job_and_pdf(db, job)
    return IngestJobDeleteResponse(action="deleted", job_id=job_id)


@router.post("/upload_pdf", response_model=PdfEnqueueResponse, status_code=202)
async def upload_rules_pdf(
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
    file: UploadFile = File(..., description="PDF del manual de reglas o lore"),
) -> PdfEnqueueResponse:
    if not file.filename or not str(file.filename).lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se admiten archivos con extensión .pdf.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if not raw.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="El archivo no parece un PDF válido (cabecera incorrecta).")
    if len(raw) > _MAX_PDF_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"El PDF supera el tamaño máximo permitido ({_MAX_PDF_BYTES // (1024 * 1024)} MB).",
        )

    settings = get_settings()
    owner_id = get_owner_id()
    job_id = uuid4()
    fname = _safe_pdf_filename(file.filename)
    stored_name = f"{job_id}_{fname}"
    dest_dir = settings.data_dir / "uploads" / str(owner_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / stored_name
    dest_path.write_bytes(raw)

    raw_name = (file.filename or "").strip()
    original_display = Path(raw_name).name if raw_name else fname

    create_job(
        db,
        job_id=job_id,
        owner_id=owner_id,
        original_filename=original_display,
        stored_path=str(dest_path.resolve()),
    )

    return PdfEnqueueResponse(
        job_id=job_id,
        status="queued",
        message="El PDF se ha encolado para indexación. El progreso aparece en la lista inferior.",
        original_filename=original_display,
    )

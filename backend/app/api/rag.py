from __future__ import annotations

import io
import logging
import re
import zipfile
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, model_validator
from sqlalchemy.orm import Session

from backend.app.campaign_rag_sync import (
    build_campaign_snapshot_text,
    sync_all_campaigns_for_owner,
    sync_campaign_to_rag_index,
)
from backend.app.config import get_settings
from backend.app.crud import get_campaign, list_sessions_by_campaign
from backend.app.db import get_db
from backend.app.deps_openai import require_openai_api_key_ctx
from backend.app.ingest_job_repo import (
    create_job,
    get_ingest_job_for_owner,
    list_jobs_for_owner,
    remove_ingest_job_and_pdf,
)
from backend.app.models import World
from backend.app.owner_context import get_owner_id, is_admin
from backend.app.rag_collection import rag_campaign_refs_collection_for_owner, rag_manuals_collection_for_owner


def _collection_name_for_rag_target(owner_id: UUID, rag_target: str) -> str:
    """Resuelve el nombre de colección pgvector a partir de `manuals` | `campaign`."""
    t = (rag_target or "manuals").strip().lower()
    if t == "manuals":
        return rag_manuals_collection_for_owner(owner_id)
    if t == "campaign":
        return rag_campaign_refs_collection_for_owner(owner_id)
    raise HTTPException(
        status_code=400,
        detail='rag_target debe ser "manuals" (manuales/reglas) o "campaign" (referencias de campaña).',
    )
from backend.app.rag_clear import clear_owner_rag_targets
from backend.app.schemas import (
    IngestJobDeleteResponse,
    IngestJobOut,
    PdfEnqueueResponse,
    RagClearRequest,
    RagClearResponse,
    UploadRagBatchResponse,
    UploadRagFileError,
)
from backend.app.services.rag_service import answer_question

logger = logging.getLogger(__name__)

router = APIRouter()

_OpenAIDep = Annotated[str, Depends(require_openai_api_key_ctx)]

_MAX_RAG_FILE_BYTES = 50 * 1024 * 1024
_ALLOWED_RAG_SUFFIXES = (".pdf", ".txt", ".docx")


def _safe_rag_stored_filename(original: str | None) -> str:
    if not original or not str(original).strip():
        return "document.pdf"
    base = Path(str(original)).name
    base = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    lower = base.lower()
    if not lower.endswith(_ALLOWED_RAG_SUFFIXES):
        base = f"{base}.pdf"
    return base[:180] if len(base) > 180 else base


def _validate_rag_file_bytes(*, raw: bytes, original_filename: str) -> str | None:
    """Devuelve mensaje de error o None si es válido."""
    if not raw:
        return "El archivo está vacío."
    if len(raw) > _MAX_RAG_FILE_BYTES:
        return f"Supera el tamaño máximo permitido ({_MAX_RAG_FILE_BYTES // (1024 * 1024)} MB)."
    name = (original_filename or "").strip()
    lower = Path(name).name.lower() if name else ""
    if not lower.endswith(_ALLOWED_RAG_SUFFIXES):
        return "Solo se admiten archivos .pdf, .txt o .docx."
    if lower.endswith(".pdf"):
        if not raw.startswith(b"%PDF"):
            return "El archivo no parece un PDF válido (cabecera incorrecta)."
        return None
    if lower.endswith(".txt"):
        text = raw.decode("utf-8-sig", errors="replace").strip()
        if not text:
            return "El fichero de texto no tiene contenido indexable."
        return None
    if lower.endswith(".docx"):
        if len(raw) < 4 or raw[:2] != b"PK" or not zipfile.is_zipfile(io.BytesIO(raw)):
            return "El archivo no parece un DOCX válido (se espera un ZIP OOXML)."
        return None
    return "Tipo de archivo no reconocido."


class QueryRequest(BaseModel):
    question: str
    scope: Literal["rules", "campaigns_general", "campaign"] = "rules"
    campaign_id: UUID | None = None
    target_owner_id: UUID | None = None

    @model_validator(mode="after")
    def _campaign_requires_id(self) -> "QueryRequest":
        if self.scope == "campaign" and self.campaign_id is None:
            raise ValueError("Si scope es «campaign», debes indicar campaign_id.")
        return self


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]


@router.post("/query_rules", response_model=QueryResponse)
def query_rules(
    payload: QueryRequest,
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
) -> QueryResponse:
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    if payload.target_owner_id is not None and not is_admin():
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede consultar el índice RAG de otro usuario.",
        )
    rag_owner = payload.target_owner_id if payload.target_owner_id is not None and is_admin() else get_owner_id()
    adm = is_admin()

    try:
        if payload.scope == "rules":
            coll = rag_manuals_collection_for_owner(rag_owner)
            result = answer_question(question, collection_name=coll)
            return QueryResponse(answer=result["answer"], sources=result["sources"])

        if payload.scope == "campaigns_general":
            sync_all_campaigns_for_owner(db, rag_owner, admin=adm)
            coll = rag_campaign_refs_collection_for_owner(rag_owner)
            result = answer_question(question, collection_name=coll)
            return QueryResponse(answer=result["answer"], sources=result["sources"])

        # scope == campaign
        assert payload.campaign_id is not None
        c = get_campaign(db, rag_owner, payload.campaign_id, admin=adm)
        if not c:
            raise HTTPException(status_code=404, detail="Campaña no encontrada.")

        sync_campaign_to_rag_index(db, rag_owner, payload.campaign_id, admin=adm)
        world = db.get(World, c.world_id) if c.world_id else None
        sessions = list_sessions_by_campaign(
            db, c.owner_id, c.id, limit=2000, offset=0, admin=adm
        )
        snapshot = build_campaign_snapshot_text(campaign=c, world=world, sessions=sessions)
        coll = rag_campaign_refs_collection_for_owner(c.owner_id)
        filt = {"campaign_id": str(c.id)}
        result = answer_question(
            question,
            collection_name=coll,
            extra_context=snapshot,
            metadata_filter=filt,
        )
        return QueryResponse(answer=result["answer"], sources=result["sources"])
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("query_rules: error procesando pregunta: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/ingest_jobs", response_model=list[IngestJobOut])
def list_ingest_jobs(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[IngestJobOut]:
    owner_id = get_owner_id()
    rows = list_jobs_for_owner(db, owner_id, limit=limit, admin=is_admin())
    return [IngestJobOut.model_validate(r) for r in rows]


@router.delete("/ingest_jobs/{job_id}", response_model=IngestJobDeleteResponse)
def delete_or_cancel_ingest_job(job_id: UUID, db: Session = Depends(get_db)) -> IngestJobDeleteResponse:
    """
    - Si el trabajo está «processing»: marca «cancelled»; el worker borra fila y PDF al detenerse.
    - En cualquier otro estado: borra la fila y el fichero subido.
    """
    owner_id = get_owner_id()
    job = get_ingest_job_for_owner(db, owner_id, job_id, admin=is_admin())
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


@router.post("/upload_pdf", response_model=UploadRagBatchResponse, status_code=202)
async def upload_rules_pdf(
    _openai: _OpenAIDep,
    db: Session = Depends(get_db),
    files: list[UploadFile] | None = File(None, description="Uno o más documentos (PDF, TXT, DOCX)."),
    file: UploadFile | None = File(None, description="Un solo archivo (compatibilidad; preferir «files»)."),
    rag_target: str = Form(
        "manuals",
        description='Colección destino: "manuals" (manuales/reglas) o "campaign" (referencias de campaña).',
    ),
    for_owner_id: str | None = Form(
        default=None,
        description="Solo administradores: UUID del usuario cuyo índice RAG debe actualizarse.",
    ),
) -> UploadRagBatchResponse:
    incoming: list[UploadFile] = []
    if files:
        incoming.extend([f for f in files if f and (f.filename or "").strip()])
    if file is not None and (file.filename or "").strip():
        incoming.append(file)
    if not incoming:
        raise HTTPException(
            status_code=400,
            detail="Envía al menos un archivo en el campo multipart «files» (puedes repetir el campo).",
        )

    settings = get_settings()
    job_owner = get_owner_id()
    if for_owner_id is not None and str(for_owner_id).strip():
        if not is_admin():
            raise HTTPException(status_code=403, detail="Solo un administrador puede subir documentos para otro usuario.")
        try:
            job_owner = UUID(str(for_owner_id).strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="for_owner_id no es un UUID válido.") from None
    owner_id = job_owner
    target_collection_name = _collection_name_for_rag_target(owner_id, rag_target)

    queued: list[PdfEnqueueResponse] = []
    errors: list[UploadRagFileError] = []

    for uf in incoming:
        raw = await uf.read()
        display_name = Path((uf.filename or "").strip() or "document").name
        err = _validate_rag_file_bytes(raw=raw, original_filename=display_name)
        if err:
            errors.append(UploadRagFileError(filename=display_name, detail=err))
            continue

        job_id = uuid4()
        fname = _safe_rag_stored_filename(uf.filename)
        stored_name = f"{job_id}_{fname}"
        dest_dir = settings.data_dir / "uploads" / str(owner_id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / stored_name
        dest_path.write_bytes(raw)

        create_job(
            db,
            job_id=job_id,
            owner_id=owner_id,
            original_filename=display_name,
            stored_path=str(dest_path.resolve()),
            target_collection_name=target_collection_name,
        )
        queued.append(
            PdfEnqueueResponse(
                job_id=job_id,
                status="queued",
                message="Documento encolado para indexación. El progreso aparece en la lista inferior.",
                original_filename=display_name,
            )
        )

    if not queued and errors:
        raise HTTPException(status_code=400, detail=[e.model_dump() for e in errors])

    return UploadRagBatchResponse(queued=queued, errors=errors)


@router.post("/rag/clear", response_model=RagClearResponse)
def rag_clear_collections(payload: RagClearRequest, db: Session = Depends(get_db)) -> RagClearResponse:
    """
    Elimina la(s) colección(es) PGVector indicadas, borra los trabajos de ingesta asociados
    y los ficheros subidos en disco, y limpia manifiestos locales de ingesta / reindexado de campañas.
    """
    if payload.target_owner_id is not None and not is_admin():
        raise HTTPException(
            status_code=403,
            detail="Solo un administrador puede vaciar las colecciones de otro usuario.",
        )
    rag_owner = payload.target_owner_id if payload.target_owner_id is not None and is_admin() else get_owner_id()
    try:
        result = clear_owner_rag_targets(db, rag_owner, targets=list(dict.fromkeys(payload.targets)))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return RagClearResponse(**result)

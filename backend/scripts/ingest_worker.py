"""
Worker independiente: reclama filas `ingest_jobs` en estado «queued» y ejecuta `ingest_pdf`.

Uso local:
  python -m backend.scripts.ingest_worker

Docker Compose: servicio `ingest-worker` con el mismo entorno y volúmenes que el backend.
"""

from __future__ import annotations

import logging
import time
import uuid
from pathlib import Path

from backend.app.db import get_sessionmaker
from backend.app.ingest import IngestCancelledError, ingest_pdf
from backend.app.ingest_job_repo import (
    claim_next_queued_job,
    finalize_job_failed,
    finalize_job_success,
    requeue_interrupted_processing_jobs,
    remove_ingest_job_and_pdf,
    update_job_progress,
)
from backend.app.models import IngestJob
from backend.app.openai_key_runtime import (
    bind_request_openai_api_key,
    reset_request_openai_api_key,
    resolve_openai_api_key_for_owner,
)

logger = logging.getLogger(__name__)

# Cada cuántos ciclos de espera (×2 s) escribir un latido en log si la cola está vacía
_IDLE_HEARTBEAT_ROUNDS = 15


def _phase_label(phase: str, current: int, total: int) -> str:
    if phase == "unchanged":
        return "Comprobando duplicados…"
    if phase == "load":
        return "Leyendo PDF…"
    if phase == "split":
        return f"Fragmentando texto ({total} bloque(s))…"
    if phase == "index":
        if total <= 0:
            return "Indexando…"
        return f"Indexando embeddings ({min(current, total)}/{total})…"
    return "Procesando…"


def _to_percent(phase: str, current: int, total: int) -> int:
    if phase == "unchanged":
        return 95
    if phase == "load":
        return 15
    if phase == "split":
        return 28
    if phase == "index":
        if total <= 0:
            return 92
        return 28 + int(67 * min(max(current, 0), total) / total)
    return 0


def process_job(job_id: uuid.UUID) -> None:
    t0 = time.monotonic()
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        job = db.get(IngestJob, job_id)
        if not job or job.status != "processing":
            logger.warning(
                "[ingest_worker] Job %s omitido (no existe o estado != processing).",
                job_id,
            )
            return
        path = job.stored_path
        owner_id = job.owner_id
        display_name = job.original_filename

    logger.info(
        "[ingest_worker] Inicio job=%s propietario=%s nombre_original=%r fichero_en_disco=%s",
        job_id,
        owner_id,
        display_name,
        Path(path).name,
    )

    with SessionLocal() as db:
        key = resolve_openai_api_key_for_owner(db, owner_id)
    if not key:
        logger.warning(
            "[ingest_worker] job=%s sin clave OpenAI para el propietario; marcando fallo.",
            job_id,
        )
        with SessionLocal() as db:
            finalize_job_failed(
                db,
                job_id,
                "No hay clave de API de OpenAI para este propietario (Ajustes o OPENAI_API_KEY en el servidor).",
                phase_label="Sin clave API",
            )
        return

    last_pct = -100
    last_write = 0.0

    def cancel_check() -> bool:
        with SessionLocal() as s:
            row = s.get(IngestJob, job_id)
            return row is None or row.status == "cancelled"

    def on_progress(phase: str, cur: int, tot: int) -> None:
        nonlocal last_pct, last_write
        if cancel_check():
            raise IngestCancelledError()
        pct = _to_percent(phase, cur, tot)
        label = _phase_label(phase, cur, tot)
        now = time.monotonic()
        force_write = phase in ("unchanged", "load", "split") or (phase == "index" and tot <= 0)
        if (
            not force_write
            and abs(pct - last_pct) < 4
            and (now - last_write) < 1.5
        ):
            return
        last_pct = pct
        last_write = now
        logger.info(
            "[ingest_worker] job=%s progreso fase=%s %d%% — %s",
            job_id,
            phase,
            pct,
            label,
        )
        with SessionLocal() as s:
            update_job_progress(s, job_id, pct, label)

    logger.info("[ingest_worker] job=%s ejecutando ingest_pdf…", job_id)
    tok = bind_request_openai_api_key(key)
    try:
        result = ingest_pdf(
            path,
            show_progress=False,
            progress_callback=on_progress,
            cancel_check=cancel_check,
        )
    except IngestCancelledError:
        logger.info(
            "[ingest_worker] job=%s cancelado por el usuario (%.1fs).",
            job_id,
            time.monotonic() - t0,
        )
        with SessionLocal() as s:
            row = s.get(IngestJob, job_id)
            if row is not None:
                remove_ingest_job_and_pdf(s, row)
        return
    except Exception as e:
        logger.exception(
            "[ingest_worker] job=%s falló tras %.1fs",
            job_id,
            time.monotonic() - t0,
        )
        with SessionLocal() as s:
            finalize_job_failed(s, job_id, str(e))
        return
    finally:
        reset_request_openai_api_key(tok)

    elapsed = time.monotonic() - t0
    logger.info(
        "[ingest_worker] job=%s ingest_pdf terminó en %.1fs (duplicado=%s chunks=%d colección=%s)",
        job_id,
        elapsed,
        result.skipped_duplicate,
        result.chunks_indexed,
        result.collection,
    )

    with SessionLocal() as s:
        finalize_job_success(
            s,
            job_id,
            skipped_duplicate=result.skipped_duplicate,
            chunks_indexed=result.chunks_indexed,
            pdf_sha256=result.pdf_sha256,
            collection=result.collection,
        )

    logger.info(
        "[ingest_worker] job=%s finalizado OK en %.1fs (estado guardado en BD).",
        job_id,
        time.monotonic() - t0,
    )


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    SessionLocal = get_sessionmaker()
    logger.info("Worker de ingesta RAG en marcha (Ctrl+C para salir).")
    with SessionLocal() as db:
        n = requeue_interrupted_processing_jobs(db)
    if n:
        logger.info(
            "[ingest_worker] Recuperación: %d trabajo(s) en «processing» → «queued» para reintentar.",
            n,
        )
    else:
        logger.info("[ingest_worker] Recuperación: ningún trabajo interrumpido pendiente.")

    idle_rounds = 0
    logger.info(
        "[ingest_worker] Polling cada 2s; si la cola está vacía, latido en log cada ~%ds.",
        2 * _IDLE_HEARTBEAT_ROUNDS,
    )
    while True:
        try:
            with SessionLocal() as db:
                jid = claim_next_queued_job(db)
            if jid is None:
                idle_rounds += 1
                if idle_rounds >= _IDLE_HEARTBEAT_ROUNDS:
                    logger.info("[ingest_worker] En espera: cola sin trabajos «queued».")
                    idle_rounds = 0
                time.sleep(2)
                continue
            idle_rounds = 0
            logger.info("[ingest_worker] Reclamado de la cola job=%s (estado → processing).", jid)
            process_job(jid)
        except KeyboardInterrupt:
            logger.info("[ingest_worker] Interrumpido por el usuario.")
            break
        except Exception:
            logger.exception("[ingest_worker] Error en el bucle principal; reintento en 5s.")
            time.sleep(5)


if __name__ == "__main__":
    main()

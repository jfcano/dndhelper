from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

from backend.app.api.auth import router as auth_router
from backend.app.auth_middleware import AuthContextMiddleware
from backend.app.api.rag import router as rag_router
from backend.app.api.campaigns import router as campaigns_router
from backend.app.api.sessions import router as sessions_router
from backend.app.api.settings import router as settings_router
from backend.app.api.worlds import router as worlds_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def _terminate_ingest_worker(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from backend.app.config import get_settings
    from backend.app.db import get_sessionmaker
    from backend.app.user_repo import ensure_admin_user_from_env

    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        ensure_admin_user_from_env(db)

    settings = get_settings()
    ingest_procs: list[subprocess.Popen] = []
    n_workers = settings.ingest_worker_count if settings.ingest_worker_autostart else 0
    if n_workers > 0:
        for i in range(n_workers):
            try:
                proc = subprocess.Popen(
                    [sys.executable, "-m", "backend.scripts.ingest_worker"],
                    cwd=str(settings.project_root),
                    env=os.environ.copy(),
                )
                ingest_procs.append(proc)
                logger.info(
                    "Worker de ingesta RAG %d/%d arrancado (pid=%s). "
                    "Ajusta INGEST_WORKER_COUNT o INGEST_WORKER_AUTOSTART=false (p. ej. Docker con servicio dedicado).",
                    i + 1,
                    n_workers,
                    proc.pid,
                )
            except OSError as e:
                logger.exception("No se pudo arrancar el worker de ingesta RAG %d/%d: %s", i + 1, n_workers, e)

    yield

    for i, ingest_proc in enumerate(ingest_procs):
        logger.info(
            "Deteniendo worker de ingesta RAG %d/%d (pid=%s)…",
            i + 1,
            len(ingest_procs),
            ingest_proc.pid,
        )
        try:
            await asyncio.to_thread(_terminate_ingest_worker, ingest_proc)
        except Exception:
            logger.exception("Error al detener el worker de ingesta (pid=%s).", ingest_proc.pid)
        else:
            logger.info("Worker de ingesta RAG (pid=%s) terminado.", ingest_proc.pid)


app = FastAPI(title="DnD Helper", lifespan=lifespan)
app.add_middleware(AuthContextMiddleware)
_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
_ADMIN_UI_DIR = Path(__file__).resolve().parents[1] / "admin_ui"

app.include_router(auth_router, prefix="/api")
app.include_router(rag_router, prefix="/api")
# Sesiones antes que campañas: rutas `/api/campaigns/.../sessions` viven aquí y deben resolverse sin ambigüedad.
app.include_router(sessions_router, prefix="/api")
app.include_router(campaigns_router, prefix="/api")
app.include_router(worlds_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


@app.get("/", response_class=HTMLResponse)
def index():
    index_html = _FRONTEND_DIR / "index.html"
    if not index_html.exists():
        raise HTTPException(status_code=404, detail="Frontend no encontrado (frontend/index.html)")
    return FileResponse(index_html, media_type="text/html")


@app.get("/health")
def health() -> dict:
    return {"ok": True}

@app.get("/admin", response_class=HTMLResponse)
def admin_index():
    index_html = _ADMIN_UI_DIR / "index.html"
    if not index_html.exists():
        raise HTTPException(status_code=404, detail="Admin UI no encontrada (backend/admin_ui/index.html)")
    return FileResponse(index_html, media_type="text/html")


if _ADMIN_UI_DIR.exists():
    app.mount("/admin/static", StaticFiles(directory=str(_ADMIN_UI_DIR)), name="admin_static")


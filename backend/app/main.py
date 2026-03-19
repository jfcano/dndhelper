from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

from backend.app.api.rag import router as rag_router
from backend.app.api.campaigns import router as campaigns_router
from backend.app.api.sessions import router as sessions_router
from backend.app.api.worlds import router as worlds_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="DnD Helper")
_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
_ADMIN_UI_DIR = Path(__file__).resolve().parents[1] / "admin_ui"

app.include_router(rag_router, prefix="/api")
app.include_router(campaigns_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(worlds_router, prefix="/api")


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


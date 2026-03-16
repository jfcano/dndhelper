from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from backend.app.rag import answer_question

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="DnD Helper")
_FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]


@app.get("/", response_class=HTMLResponse)
def index():
    index_html = _FRONTEND_DIR / "index.html"
    if not index_html.exists():
        raise HTTPException(status_code=404, detail="Frontend no encontrado (frontend/index.html)")
    return FileResponse(index_html, media_type="text/html")


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/query_rules", response_model=QueryResponse)
def query_rules(payload: QueryRequest) -> QueryResponse:
    question = (payload.question or "").strip()
    if not question:
        logger.warning("query_rules: pregunta vacía rechazada")
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    logger.info("query_rules: pregunta recibida: %s", question[:80])
    try:
        result = answer_question(question)
        logger.info("query_rules: respuesta enviada (%d fuentes)", len(result.get("sources", [])))
        return QueryResponse(answer=result["answer"], sources=result["sources"])
    except Exception as e:
        logger.exception("query_rules: error procesando pregunta: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from backend.app.services.rag_service import answer_question

logger = logging.getLogger(__name__)

router = APIRouter()


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]


@router.post("/query_rules", response_model=QueryResponse)
def query_rules(payload: QueryRequest) -> QueryResponse:
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    try:
        result = answer_question(question)
        return QueryResponse(answer=result["answer"], sources=result["sources"])
    except Exception as e:
        logger.exception("query_rules: error procesando pregunta: %s", e)
        raise HTTPException(status_code=500, detail=str(e)) from e


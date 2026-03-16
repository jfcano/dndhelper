from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from backend.app.rag import answer_question


app = FastAPI(title="DnD Helper (Fase 1)")


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[dict]


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/query_rules", response_model=QueryResponse)
def query_rules(payload: QueryRequest) -> QueryResponse:
    question = (payload.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    try:
        result = answer_question(question)
        return QueryResponse(answer=result["answer"], sources=result["sources"])
    except Exception as e:  # MVP: devolver error claro
        raise HTTPException(status_code=500, detail=str(e)) from e


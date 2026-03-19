from __future__ import annotations

from uuid import uuid4

import pytest


def test_health(client) -> None:
    r = client.get("/health")

    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_query_rules_validates_empty_question(client) -> None:
    r = client.post("/api/query_rules", json={"question": "   "})
    assert r.status_code == 400


def test_query_rules_returns_answer_from_rag_mock(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.api import rag as rag_api

    def _fake_answer_question(question: str, *, k: int = 4) -> dict:
        assert question
        return {"answer": "Respuesta fake", "sources": [{"source": "x", "page": 1}]}

    monkeypatch.setattr(rag_api, "answer_question", _fake_answer_question)

    r = client.post("/api/query_rules", json={"question": "¿Qué es una tirada de salvación?"})
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "Respuesta fake"
    assert isinstance(body["sources"], list)
    assert body["sources"][0]["source"] == "x"


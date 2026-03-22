from __future__ import annotations

from uuid import uuid4

import pytest


def test_query_rules_target_owner_id_allowed_for_admin(admin_client, client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.api import rag as rag_api

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    target = me.json()["id"]

    def _fake_answer_question(*args: object, **kwargs: object) -> dict:
        return {"answer": "admin-scope", "sources": []}

    monkeypatch.setattr(rag_api, "answer_question", _fake_answer_question)

    r = admin_client.post(
        "/api/query_rules",
        json={"question": "Pregunta", "scope": "rules", "target_owner_id": target},
    )
    assert r.status_code == 200
    assert r.json()["answer"] == "admin-scope"


def test_rag_clear_target_owner_id_forbidden_for_non_admin(client) -> None:
    r = client.post(
        "/api/rag/clear",
        json={"targets": ["manuals"], "target_owner_id": str(uuid4())},
    )
    assert r.status_code == 403


def test_rag_clear_target_owner_id_admin_ok(admin_client, client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app import rag_clear as rc

    monkeypatch.setattr(rc, "_drop_collection", lambda name: True)

    me = client.get("/api/auth/me").json()["id"]
    r = admin_client.post("/api/rag/clear", json={"targets": ["manuals", "campaign"], "target_owner_id": me})
    assert r.status_code == 200
    body = r.json()
    assert set(body["targets_cleared"]) >= {"manuals", "campaign"}

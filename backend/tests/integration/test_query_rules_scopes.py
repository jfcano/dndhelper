from __future__ import annotations

from uuid import uuid4

import pytest


def test_query_rules_scope_campaign_without_id_returns_422(client) -> None:
    r = client.post("/api/query_rules", json={"question": "¿Algo?", "scope": "campaign"})
    assert r.status_code == 422


def test_query_rules_scope_campaign_unknown_returns_404(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.api import rag as rag_api

    def _fake_answer_question(*args: object, **kwargs: object) -> dict:
        raise AssertionError("no debe llamarse a answer_question si la campaña no existe")

    monkeypatch.setattr(rag_api, "answer_question", _fake_answer_question)
    r = client.post(
        "/api/query_rules",
        json={"question": "¿Algo?", "scope": "campaign", "campaign_id": str(uuid4())},
    )
    assert r.status_code == 404


def test_query_rules_target_owner_id_forbidden_for_non_admin(client) -> None:
    r = client.post(
        "/api/query_rules",
        json={"question": "¿Algo?", "scope": "rules", "target_owner_id": str(uuid4())},
    )
    assert r.status_code == 403


def test_query_rules_campaigns_general_ok_with_mocks(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.api import rag as rag_api

    def _fake_sync_all(*args: object, **kwargs: object) -> None:
        return None

    def _fake_answer_question(*args: object, **kwargs: object) -> dict:
        return {"answer": "ok", "sources": []}

    monkeypatch.setattr(rag_api, "sync_all_campaigns_for_owner", _fake_sync_all)
    monkeypatch.setattr(rag_api, "answer_question", _fake_answer_question)

    r = client.post("/api/query_rules", json={"question": "Resumen global", "scope": "campaigns_general"})
    assert r.status_code == 200
    assert r.json()["answer"] == "ok"

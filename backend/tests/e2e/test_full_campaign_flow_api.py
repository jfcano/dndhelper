from __future__ import annotations

import json

import pytest


def test_e2e_campaign_from_brief_to_sessions(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    STORY = "## Historia (e2e)\n- Punto"

    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: STORY)

    class _GO:
        def __init__(self) -> None:
            self.campaign_title = "Campaña E2E"
            self.raw = {"some": "outline-data"}

    monkeypatch.setattr(generation_service, "generate_outline", lambda *args, **kwargs: _GO())

    SESSIONS = [
        {
            "session_number": 1,
            "title": "Sesión 1",
            "summary": "S1",
            "content_draft": {"opening_scene": "inicio", "objectives": ["x"], "scenes": []},
        },
        {
            "session_number": 2,
            "title": "Sesión 2",
            "summary": "S2",
            "content_draft": {"opening_scene": "continúa", "objectives": ["y"], "scenes": []},
        },
    ]
    monkeypatch.setattr(generation_service, "generate_sessions", lambda *args, **kwargs: SESSIONS)

    # 1) World aprobado
    r = client.post("/api/worlds", json={"name": "Mundo"})
    assert r.status_code == 200
    wid = r.json()["id"]

    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Contenido del mundo"})
    assert r.status_code == 200
    r = client.post(f"/api/worlds/{wid}/approve", json={})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    # 2) Campaign -> link world
    r = client.post("/api/campaigns", json={"name": "Camp"})
    assert r.status_code == 200
    cid = r.json()["id"]

    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    # 3) Brief aprobado => story_final
    brief = {"kind": "sandbox", "themes": ["aventura"], "starting_level": 1, "inspirations": [], "tone": "heroico"}
    r = client.post(f"/api/campaigns/{cid}/brief", json=brief)
    assert r.status_code == 200
    assert r.json()["story_draft"] == STORY

    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200
    assert r.json()["story_final"] == STORY

    # 4) Outline aprobado
    r = client.post(f"/api/campaigns/{cid}/outline:generate", json={})
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/outline/approve", json={})
    assert r.status_code == 200

    # 5) Sessions generate + persist
    r = client.post(f"/api/campaigns/{cid}/sessions:generate?session_count=2", json={})
    assert r.status_code == 200
    sessions = r.json()
    assert len(sessions) == 2
    assert sessions[0]["approval_status"] == "draft"

    # 6) Approve session #1
    sid1 = sessions[0]["id"]
    content_draft_1 = sessions[0]["content_draft"]
    r = client.post(f"/api/sessions/{sid1}/approve", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["approval_status"] == "approved"
    assert body["content_final"] == content_draft_1

    parsed = json.loads(body["content_final"])
    assert parsed["opening_scene"] in ("inicio", "continúa")


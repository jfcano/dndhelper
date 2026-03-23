from __future__ import annotations

import pytest


def _create_world_and_approve(client) -> str:
    r = client.post("/api/worlds", json={"name": "Mundo"})
    assert r.status_code == 200
    wid = r.json()["id"]
    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Contenido del mundo"})
    assert r.status_code == 200
    r = client.post(f"/api/worlds/{wid}/approve", json={})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    return wid


def _create_campaign_link_to_world(client, *, world_id: str) -> str:
    r = client.post("/api/campaigns", json={"name": "Camp"})
    assert r.status_code == 200
    cid = r.json()["id"]
    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": world_id})
    assert r.status_code == 200
    assert r.json()["world_id"] == world_id
    return cid


def test_campaign_story_approve_then_reopen_edit_and_reset(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    STORY = "## Historia (fake)\n- Test"
    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: STORY)

    wid = _create_world_and_approve(client)
    cid = _create_campaign_link_to_world(client, world_id=wid)

    brief = {
        "kind": "sandbox",
        "tone": "heroico",
        "themes": ["aventura"],
        "starting_level": 1,
        "inspirations": [],
    }
    r = client.post(f"/api/campaigns/{cid}/brief", json=brief)
    assert r.status_code == 200
    assert r.json()["brief_status"] == "draft"
    assert r.json()["story_draft"] == STORY

    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["brief_status"] == "approved"
    assert body["story_final"] == STORY

    # No se puede editar story_draft mientras está aprobado
    r = client.patch(f"/api/campaigns/{cid}/story", json={"story_draft": "Nuevo"})
    assert r.status_code == 409

    # Reabrir permite edición
    r = client.post(f"/api/campaigns/{cid}/reopen", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["brief_status"] == "draft"
    assert body["story_draft"] == STORY

    r = client.patch(f"/api/campaigns/{cid}/story", json={"story_draft": "Nuevo"})
    assert r.status_code == 200
    body = r.json()
    assert body["story_draft"] == "Nuevo"

    # Reset vacía ambos campos
    r = client.post(f"/api/campaigns/{cid}/story/reset", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["story_draft"] is None
    assert body["story_final"] is None


def test_outline_approve_and_generate_sessions(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    STORY = "## Historia (fake)"
    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: STORY)

    class _GO:
        def __init__(self) -> None:
            self.campaign_title = "Campaña Fake"
            self.raw = {"some": "outline"}

    monkeypatch.setattr(generation_service, "generate_outline", lambda *args, **kwargs: _GO())

    SESSIONS = [
        {
            "session_number": 1,
            "title": "Sesión 1",
            "summary": "S1",
        }
    ]
    monkeypatch.setattr(generation_service, "generate_sessions", lambda *args, **kwargs: SESSIONS)

    wid = _create_world_and_approve(client)
    cid = _create_campaign_link_to_world(client, world_id=wid)

    brief = {"kind": "sandbox", "themes": ["aventura"], "starting_level": 1, "inspirations": [], "tone": "heroico"}
    r = client.post(f"/api/campaigns/{cid}/brief", json=brief)
    assert r.status_code == 200

    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200

    r = client.post(f"/api/campaigns/{cid}/outline:generate", json={})
    assert r.status_code == 200
    assert r.json()["outline_status"] == "draft"

    r = client.post(f"/api/campaigns/{cid}/outline/approve", json={})
    assert r.status_code == 200
    assert r.json()["outline_status"] == "approved"

    r = client.post(f"/api/campaigns/{cid}/sessions:generate?session_count=1", json={})
    assert r.status_code == 200
    sessions = r.json()
    assert isinstance(sessions, list)
    assert len(sessions) == 1

    s = sessions[0]
    assert s["approval_status"] == "draft"
    assert s["status"] == "planned"
    assert s["session_number"] == 1
    assert s["summary"] == "S1"
    assert s["content_draft"] is None

    sid = s["id"]
    r = client.post(f"/api/sessions/{sid}/approve", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["approval_status"] == "approved"
    assert body["content_final"] is None
    assert body["content_draft"] is None


def test_sessions_generate_requires_outline_approved(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: "## Story")

    wid = _create_world_and_approve(client)
    cid = _create_campaign_link_to_world(client, world_id=wid)

    brief = {"kind": "sandbox", "themes": ["aventura"], "starting_level": 1, "inspirations": [], "tone": "heroico"}
    r = client.post(f"/api/campaigns/{cid}/brief", json=brief)
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200

    r = client.post(f"/api/campaigns/{cid}/sessions:generate?session_count=1", json={})
    assert r.status_code == 400


def test_sessions_generate_returns_502_when_model_json_is_invalid(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: "## Story")
    monkeypatch.setattr(
        generation_service,
        "generate_outline",
        lambda *args, **kwargs: type("GO", (), {"campaign_title": "Camp", "raw": {"outline": "ok"}})(),
    )
    monkeypatch.setattr(
        generation_service,
        "generate_sessions",
        lambda *args, **kwargs: (_ for _ in ()).throw(ValueError("json inválido")),
    )

    wid = _create_world_and_approve(client)
    cid = _create_campaign_link_to_world(client, world_id=wid)
    brief = {"kind": "sandbox", "themes": ["aventura"], "starting_level": 1, "inspirations": [], "tone": "heroico"}

    assert client.post(f"/api/campaigns/{cid}/brief", json=brief).status_code == 200
    assert client.post(f"/api/campaigns/{cid}/brief/approve", json={}).status_code == 200
    assert client.post(f"/api/campaigns/{cid}/outline:generate", json={}).status_code == 200
    assert client.post(f"/api/campaigns/{cid}/outline/approve", json={}).status_code == 200

    r = client.post(f"/api/campaigns/{cid}/sessions:generate?session_count=1", json={})
    assert r.status_code == 502
    assert "salida no válida" in r.json().get("detail", "").lower()


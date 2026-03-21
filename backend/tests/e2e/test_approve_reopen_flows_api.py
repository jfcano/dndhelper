"""
E2E (API) de aprobación y vuelta a borrador para todas las entidades con ese flujo:

- Mundo: POST .../approve, POST .../reopen
- Campaña: POST .../brief/approve, POST .../reopen (brief + outline vuelven a draft)
- Outline: POST .../outline/approve; la vuelta a borrador es vía reopen de campaña
- Sesión: POST .../approve, POST /api/sessions/{id}/reopen
"""

from __future__ import annotations

import pytest


def _create_approved_world(client) -> str:
    r = client.post("/api/worlds", json={"name": "Mundo E2E approve"})
    assert r.status_code == 200
    wid = r.json()["id"]
    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Borrador mundo v1"})
    assert r.status_code == 200
    r = client.post(f"/api/worlds/{wid}/approve", json={})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    assert r.json()["content_final"] == "Borrador mundo v1"
    return wid


def _brief_payload():
    return {
        "kind": "sandbox",
        "themes": ["aventura"],
        "starting_level": 1,
        "inspirations": [],
        "tone": "heroico",
    }


def test_e2e_world_approve_reopen_edit_reapprove(client) -> None:
    wid = _create_approved_world(client)

    r = client.post(f"/api/worlds/{wid}/reopen", json={})
    assert r.status_code == 200
    w = r.json()
    assert w["status"] == "draft"
    assert w["content_draft"] == "Borrador mundo v1"

    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Borrador mundo v2"})
    assert r.status_code == 200
    r = client.post(f"/api/worlds/{wid}/approve", json={})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"
    assert r.json()["content_final"] == "Borrador mundo v2"


def test_e2e_campaign_brief_approve_reopen_allows_story_patch(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    STORY = "## Historia\n- Gancho"
    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: STORY)

    wid = _create_approved_world(client)
    r = client.post("/api/campaigns", json={"name": "Camp approve"})
    assert r.status_code == 200
    cid = r.json()["id"]
    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    r = client.post(f"/api/campaigns/{cid}/brief", json=_brief_payload())
    assert r.status_code == 200
    assert r.json()["brief_status"] == "draft"

    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200
    c = r.json()
    assert c["brief_status"] == "approved"
    assert c["story_final"] == STORY

    r = client.patch(f"/api/campaigns/{cid}/story", json={"story_draft": "## Intento"})
    assert r.status_code == 409

    r = client.post(f"/api/campaigns/{cid}/reopen", json={})
    assert r.status_code == 200
    c = r.json()
    assert c["brief_status"] == "draft"
    assert c["outline_status"] == "draft"

    r = client.patch(f"/api/campaigns/{cid}/story", json={"story_draft": "## Historia editada"})
    assert r.status_code == 200
    assert r.json()["story_draft"] == "## Historia editada"


def test_e2e_campaign_outline_approve_then_reopen_via_campaign(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    STORY = "## Story\nOK"
    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: STORY)

    class _GO:
        def __init__(self) -> None:
            self.campaign_title = "T"
            self.raw = {"outline": True}

    monkeypatch.setattr(generation_service, "generate_outline", lambda *args, **kwargs: _GO())

    wid = _create_approved_world(client)
    r = client.post("/api/campaigns", json={"name": "Camp outline"})
    assert r.status_code == 200
    cid = r.json()["id"]
    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    r = client.post(f"/api/campaigns/{cid}/brief", json=_brief_payload())
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200

    r = client.post(f"/api/campaigns/{cid}/outline:generate", json={})
    assert r.status_code == 200
    assert r.json()["outline_status"] == "draft"
    outline_draft = r.json()["outline_draft"]
    assert outline_draft

    r = client.post(f"/api/campaigns/{cid}/outline/approve", json={})
    assert r.status_code == 200
    c = r.json()
    assert c["outline_status"] == "approved"
    assert c["outline_final"] == outline_draft

    r = client.post(f"/api/campaigns/{cid}/reopen", json={})
    assert r.status_code == 200
    c = r.json()
    assert c["outline_status"] == "draft"
    assert c["outline_draft"] == outline_draft


def test_e2e_session_approve_idempotent_and_reopen_urls(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    STORY = "## H\nX"
    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: STORY)

    class _GO:
        def __init__(self) -> None:
            self.campaign_title = "T"
            self.raw = {"o": 1}

    monkeypatch.setattr(generation_service, "generate_outline", lambda *args, **kwargs: _GO())
    monkeypatch.setattr(
        generation_service,
        "generate_sessions",
        lambda *args, **kwargs: [{"session_number": 1, "title": "S1", "summary": "sum"}],
    )

    wid = _create_approved_world(client)
    r = client.post("/api/campaigns", json={"name": "Camp ses"})
    cid = r.json()["id"]
    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/brief", json=_brief_payload())
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/outline:generate", json={})
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/outline/approve", json={})
    assert r.status_code == 200

    r = client.post(f"/api/campaigns/{cid}/sessions:generate?session_count=1", json={})
    assert r.status_code == 200
    sid = r.json()[0]["id"]

    r = client.patch(f"/api/sessions/{sid}", json={"content_draft": "## Guion"})
    assert r.status_code == 200

    r = client.post(f"/api/sessions/{sid}/approve", json={})
    assert r.status_code == 200
    assert r.json()["approval_status"] == "approved"

    r = client.post(f"/api/sessions/{sid}/approve", json={})
    assert r.status_code == 200
    assert r.json()["approval_status"] == "approved"

    r = client.post(f"/api/sessions/{sid}/reopen", json={})
    assert r.status_code == 200
    assert r.json()["approval_status"] == "draft"

    r = client.post(f"/api/sessions/{sid}/approve", json={})
    assert r.status_code == 200
    assert r.json()["approval_status"] == "approved"

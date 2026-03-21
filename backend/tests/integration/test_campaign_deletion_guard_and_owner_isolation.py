from __future__ import annotations

import pytest


def test_campaign_delete_guard_when_story_approved_blocks(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: "## Historia")

    r = client.post("/api/worlds", json={"name": "Mundo"})
    wid = r.json()["id"]
    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Contenido"})
    assert r.status_code == 200
    r = client.post(f"/api/worlds/{wid}/approve", json={})
    assert r.status_code == 200

    r = client.post("/api/campaigns", json={"name": "Camp"})
    cid = r.json()["id"]
    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    brief = {"kind": "sandbox", "themes": ["aventura"], "starting_level": 1, "inspirations": [], "tone": "heroico"}
    r = client.post(f"/api/campaigns/{cid}/brief", json=brief)
    assert r.status_code == 200
    r = client.post(f"/api/campaigns/{cid}/brief/approve", json={})
    assert r.status_code == 200

    r = client.delete(f"/api/campaigns/{cid}")
    assert r.status_code == 409


def test_campaign_delete_allowed_without_approval(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *args, **kwargs: "## Historia")

    r = client.post("/api/worlds", json={"name": "Mundo"})
    wid = r.json()["id"]
    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Contenido"})
    assert r.status_code == 200
    r = client.post(f"/api/worlds/{wid}/approve", json={})
    assert r.status_code == 200

    r = client.post("/api/campaigns", json={"name": "Camp"})
    cid = r.json()["id"]
    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    brief = {"kind": "sandbox", "themes": ["aventura"], "starting_level": 1, "inspirations": [], "tone": "heroico"}
    r = client.post(f"/api/campaigns/{cid}/brief", json=brief)
    assert r.status_code == 200

    # brief_status sigue en draft -> borrado debería estar permitido
    r = client.delete(f"/api/campaigns/{cid}")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_owner_isolation_worlds_and_campaigns(client) -> None:
    from fastapi.testclient import TestClient

    from backend.app.main import app

    r = client.post("/api/worlds", json={"name": "Mundo"})
    assert r.status_code == 200
    wid = r.json()["id"]

    r = client.post("/api/campaigns", json={"name": "Camp"})
    assert r.status_code == 200
    cid = r.json()["id"]

    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    other = TestClient(app)
    reg = other.post("/api/auth/register", json={"username": "user_b_iso", "password": "pw12345678"})
    assert reg.status_code == 200, reg.text
    other.headers.update({"Authorization": f"Bearer {reg.json()['access_token']}"})

    r = other.get("/api/campaigns")
    assert r.status_code == 200
    assert r.json() == []

    r = other.get(f"/api/worlds/{wid}")
    assert r.status_code == 404

    r = other.get(f"/api/campaigns/{cid}")
    assert r.status_code == 404


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


def test_owner_isolation_worlds_and_campaigns(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from uuid import UUID

    owner1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    owner2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    monkeypatch.setenv("LOCAL_OWNER_UUID", owner1)

    r = client.post("/api/worlds", json={"name": "Mundo"})
    assert r.status_code == 200
    wid = r.json()["id"]

    r = client.post("/api/campaigns", json={"name": "Camp"})
    assert r.status_code == 200
    cid = r.json()["id"]

    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    monkeypatch.setenv("LOCAL_OWNER_UUID", owner2)

    r = client.get("/api/campaigns")
    assert r.status_code == 200
    assert r.json() == []

    r = client.get(f"/api/worlds/{wid}")
    assert r.status_code == 404

    r = client.get(f"/api/campaigns/{cid}")
    assert r.status_code == 404


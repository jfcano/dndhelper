from __future__ import annotations

import pytest


def test_outline_generate_requires_world_approved(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *a, **k: "## Historia")

    r = client.post("/api/worlds", json={"name": "Mundo borrador"})
    assert r.status_code == 200
    wid = r.json()["id"]
    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Lore en borrador"})
    assert r.status_code == 200

    r = client.post("/api/campaigns", json={"name": "Camp"})
    cid = r.json()["id"]
    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    brief = {"kind": "sandbox", "themes": ["x"], "starting_level": 1, "inspirations": [], "tone": "heroico"}
    assert client.post(f"/api/campaigns/{cid}/brief", json=brief).status_code == 200
    assert client.post(f"/api/campaigns/{cid}/brief/approve", json={}).status_code == 200

    r = client.post(f"/api/campaigns/{cid}/outline:generate", json={})
    assert r.status_code == 400
    assert "aprobado" in r.json().get("detail", "").lower()


def test_outline_approve_without_draft_returns_400(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.services import generation_service

    monkeypatch.setattr(generation_service, "generate_campaign_story_draft", lambda *a, **k: "## H")

    r = client.post("/api/worlds", json={"name": "M2"})
    wid = r.json()["id"]
    client.patch(f"/api/worlds/{wid}", json={"content_draft": "c"})
    client.post(f"/api/worlds/{wid}/approve", json={})

    r = client.post("/api/campaigns", json={"name": "C2"})
    cid = r.json()["id"]
    client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    brief = {"kind": "sandbox", "themes": ["x"], "starting_level": 1, "inspirations": [], "tone": "heroico"}
    client.post(f"/api/campaigns/{cid}/brief", json=brief)
    client.post(f"/api/campaigns/{cid}/brief/approve", json={})

    r = client.post(f"/api/campaigns/{cid}/outline/approve", json={})
    assert r.status_code == 400

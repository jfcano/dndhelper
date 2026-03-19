from __future__ import annotations

import pytest


def test_world_crud_approve_reopen(client) -> None:
    r = client.post("/api/worlds", json={"name": "Mundo1"})
    assert r.status_code == 200
    wid = r.json()["id"]
    assert r.json()["status"] == "draft"

    r = client.patch(f"/api/worlds/{wid}", json={"content_draft": "Contenido inicial"})
    assert r.status_code == 200
    assert r.json()["content_draft"] == "Contenido inicial"

    r = client.post(f"/api/worlds/{wid}/approve", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "approved"
    assert body["content_final"] == "Contenido inicial"

    r = client.post(f"/api/worlds/{wid}/reopen", json={})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "draft"
    assert body["content_draft"] == "Contenido inicial"


def test_world_delete_guard_when_used_by_campaign(client) -> None:
    r = client.post("/api/worlds", json={"name": "Mundo1"})
    wid = r.json()["id"]

    r = client.post("/api/campaigns", json={"name": "Camp"})
    cid = r.json()["id"]

    r = client.patch(f"/api/campaigns/{cid}", json={"world_id": wid})
    assert r.status_code == 200

    r = client.delete(f"/api/worlds/{wid}")
    assert r.status_code == 409


def test_world_generate_validation_missing_faction(client) -> None:
    payload = {
        "theme_and_mood": "Oscuro y heroico",
        "factions": [{"name": "Guardián", "objective": "Proteger el orden"}],
        "characters": [
            {"name": "Aria", "faction_name": "Rebeldes", "role": "Exploradora", "motivation": "Buscar la verdad"},
        ],
        "cities": [{"name": "Ciudadela", "theme": "Basalto y juramentos", "relations": []}],
    }
    r = client.post("/api/worlds:generate", json=payload)
    assert r.status_code == 400
    assert "Hay personajes con facción no definida" in r.json().get("detail", "")


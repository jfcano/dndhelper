from __future__ import annotations

import json


def test_generation_flow_brief_world_outline_arcs_sessions(db_client, monkeypatch):
    # Mock generación para no llamar a OpenAI
    from backend.app.services import generation_service

    def _fake_world(*, brief):  # noqa: ANN001
        class _GW:
            name = "Mundo Fake"
            tone = "heroico"
            pitch = "Una chispa en la oscuridad."
            themes = {"themes": ["aventura"]}
            draft = {"overview": "World overview", "regions": [], "factions": [], "major_npcs": []}

        return _GW()

    def _fake_outline(*, brief, world):  # noqa: ANN001
        class _GO:
            campaign_title = "Campaña Fake"
            raw = {"campaign_title": "Campaña Fake", "arc_seeds": [{"title": "A1", "summary": "S", "order_index": 1}]}

        return _GO()

    def _fake_arcs(*, outline, arc_count):  # noqa: ANN001
        return [{"title": "Arc 1", "summary": "Resumen", "order_index": 1}]

    def _fake_sessions(*, arc, outline, session_count, starting_session_number):  # noqa: ANN001
        return [
            {
                "session_number": starting_session_number,
                "title": "Sesión 1",
                "summary": "S",
                "content_draft": {"opening_scene": "inicio", "objectives": ["x"], "scenes": []},
            }
        ]

    monkeypatch.setattr(generation_service, "generate_world", _fake_world)
    monkeypatch.setattr(generation_service, "generate_outline", _fake_outline)
    monkeypatch.setattr(generation_service, "generate_arcs", _fake_arcs)
    monkeypatch.setattr(generation_service, "generate_sessions", _fake_sessions)

    # Crear campaña
    r = db_client.post("/api/campaigns", json={"name": "Camp"})
    assert r.status_code == 200
    cid = r.json()["id"]

    # No puede generar mundo sin brief aprobado
    r = db_client.post(f"/api/campaigns/{cid}/world:generate")
    assert r.status_code == 400

    # Brief draft + approve
    brief = {"kind": "sandbox", "tone": "heroico", "themes": ["aventura"], "starting_level": 1, "inspirations": []}
    r = db_client.post(f"/api/campaigns/{cid}/brief", json=brief)
    assert r.status_code == 200
    assert r.json()["brief_status"] == "draft"

    r = db_client.post(f"/api/campaigns/{cid}/brief/approve")
    assert r.status_code == 200
    assert r.json()["brief_status"] == "approved"

    # Generar mundo (crea world y vincula world_id)
    r = db_client.post(f"/api/campaigns/{cid}/world:generate")
    assert r.status_code == 200
    camp = r.json()
    assert camp["world_id"] is not None
    wid = camp["world_id"]

    # Aprobar world
    r = db_client.post(f"/api/worlds/{wid}/approve")
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    # Generar outline
    r = db_client.post(f"/api/campaigns/{cid}/outline:generate")
    assert r.status_code == 200
    assert r.json()["outline_status"] == "draft"

    # Aprobar outline
    r = db_client.post(f"/api/campaigns/{cid}/outline/approve")
    assert r.status_code == 200
    assert r.json()["outline_status"] == "approved"

    # Generar arcos
    r = db_client.post(f"/api/campaigns/{cid}/arcs:generate?arc_count=1")
    assert r.status_code == 200
    arcs = r.json()
    assert len(arcs) == 1
    aid = arcs[0]["id"]

    # No puede generar sesiones sin aprobar arco
    r = db_client.post(f"/api/arcs/{aid}/sessions:generate?session_count=1")
    assert r.status_code == 400

    r = db_client.post(f"/api/arcs/{aid}/approve")
    assert r.status_code == 200
    assert r.json()["approval_status"] == "approved"

    # Generar sesiones
    r = db_client.post(f"/api/arcs/{aid}/sessions:generate?session_count=1")
    assert r.status_code == 200
    sessions = r.json()
    assert len(sessions) == 1
    sid = sessions[0]["id"]
    assert sessions[0]["content_draft"] is not None

    # Aprobar sesión
    r = db_client.post(f"/api/sessions/{sid}/approve")
    assert r.status_code == 200
    assert r.json()["approval_status"] == "approved"

    # El content_final debe copiarse
    assert r.json()["content_final"] == r.json()["content_draft"]


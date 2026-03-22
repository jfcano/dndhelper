from __future__ import annotations

from uuid import UUID, uuid4

import pytest


def _owner_uuid(client) -> UUID:
    r = client.get("/api/auth/me")
    assert r.status_code == 200
    return UUID(r.json()["id"])


def test_list_all_sessions_empty_then_one(client) -> None:
    r = client.get("/api/all-sessions")
    assert r.status_code == 200
    assert r.json() == []

    from backend.app import crud
    from backend.app.db import get_sessionmaker
    from backend.app.schemas import CampaignCreate, SessionCreate

    oid = _owner_uuid(client)
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        camp = crud.create_campaign(db, oid, CampaignCreate(name="SessCamp", system="5e"))
        crud.create_session(
            db,
            oid,
            camp.id,
            SessionCreate(session_number=1, title="Una sesión", summary=None, status="planned", notes=None),
        )

    r = client.get("/api/all-sessions")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1
    assert rows[0]["title"] == "Una sesión"


def test_list_sessions_unknown_campaign_returns_404(client) -> None:
    r = client.get(f"/api/campaigns/{uuid4()}/sessions")
    assert r.status_code == 404


def test_delete_session_ok(client) -> None:
    from backend.app import crud
    from backend.app.db import get_sessionmaker
    from backend.app.schemas import CampaignCreate, SessionCreate

    oid = _owner_uuid(client)
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        camp = crud.create_campaign(db, oid, CampaignCreate(name="DelCamp", system="5e"))
        s = crud.create_session(
            db,
            oid,
            camp.id,
            SessionCreate(session_number=1, title="Borrar", summary=None, status="planned", notes=None),
        )
        sid = s.id

    r = client.delete(f"/api/sessions/{sid}")
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r = client.get(f"/api/sessions/{sid}")
    assert r.status_code == 404


def test_patch_session_when_approved_returns_409(client) -> None:
    from backend.app import crud
    from backend.app.db import get_sessionmaker
    from backend.app.schemas import CampaignCreate, SessionCreate

    oid = _owner_uuid(client)
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        camp = crud.create_campaign(db, oid, CampaignCreate(name="ApprCamp", system="5e"))
        s = crud.create_session(
            db,
            oid,
            camp.id,
            SessionCreate(session_number=1, title="T", summary=None, status="planned", notes=None),
        )
        sid = s.id

    r = client.post(f"/api/sessions/{sid}/approve", json={})
    assert r.status_code == 200

    r = client.patch(f"/api/sessions/{sid}", json={"title": "Nuevo"})
    assert r.status_code == 409


def test_world_image_serves_png(client, tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.api import worlds as worlds_api

    r = client.post("/api/worlds", json={"name": "ImgWorld"})
    assert r.status_code == 200
    wid = r.json()["id"]

    d = tmp_path / "world_images" / wid
    d.mkdir(parents=True)
    png = d / "map.png"
    png.write_bytes(b"\x89PNG\r\n\x1a\n" + b"\x00" * 20)

    monkeypatch.setattr(worlds_api.world_image_service, "world_images_dir", lambda _wid: d)

    r = client.get(f"/api/worlds/{wid}/image/map.png")
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")


def test_world_image_invalid_filename_returns_400(client) -> None:
    r = client.post("/api/worlds", json={"name": "W2"})
    wid = r.json()["id"]
    r = client.get(f"/api/worlds/{wid}/image/!.png")
    assert r.status_code == 400

from __future__ import annotations

from fastapi.testclient import TestClient


def test_register_login_me_logout_flow() -> None:
    from backend.app.main import app

    c = TestClient(app)
    r = c.post("/api/auth/register", json={"username": "auth_flow_u", "password": "pw12345678"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["access_token"]
    assert body["user"]["username"] == "auth_flow_u"

    c.headers.update({"Authorization": f"Bearer {body['access_token']}"})
    me = c.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "auth_flow_u"

    r2 = c.post("/api/auth/login", json={"username": "auth_flow_u", "password": "pw12345678"})
    assert r2.status_code == 200
    assert r2.json()["user"]["id"] == body["user"]["id"]


def test_register_duplicate_username_conflict() -> None:
    from backend.app.main import app

    c = TestClient(app)
    p = {"username": "dup_u", "password": "pw12345678"}
    assert c.post("/api/auth/register", json=p).status_code == 200
    r = c.post("/api/auth/register", json=p)
    assert r.status_code == 409


def test_api_requires_auth() -> None:
    from backend.app.main import app

    c = TestClient(app)
    r = c.get("/api/campaigns")
    assert r.status_code == 401

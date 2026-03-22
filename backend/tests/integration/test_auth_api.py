from __future__ import annotations

from fastapi.testclient import TestClient

from backend.tests.helpers import ensure_test_admin_exists


def test_register_login_me_logout_flow() -> None:
    from backend.app.main import app

    ensure_test_admin_exists()
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

    ensure_test_admin_exists()
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


def test_login_wrong_password() -> None:
    from backend.app.main import app

    ensure_test_admin_exists()
    c = TestClient(app)
    assert (
        c.post("/api/auth/register", json={"username": "login_wrong_pw_u", "password": "pw12345678"}).status_code
        == 200
    )
    r = c.post("/api/auth/login", json={"username": "login_wrong_pw_u", "password": "otra_clave_mala"})
    assert r.status_code == 401
    assert "incorrectos" in r.json().get("detail", "").lower()


def test_bearer_invalid_token() -> None:
    from backend.app.main import app

    c = TestClient(app)
    c.headers.update({"Authorization": "Bearer no-es-un-jwt.valido"})
    r = c.get("/api/campaigns")
    assert r.status_code == 401


def test_register_username_too_short_validation() -> None:
    from backend.app.main import app

    c = TestClient(app)
    r = c.post("/api/auth/register", json={"username": "ab", "password": "pw12345678"})
    assert r.status_code == 422

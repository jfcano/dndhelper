from __future__ import annotations

from fastapi.testclient import TestClient


def test_setup_status_needs_setup_when_empty() -> None:
    from backend.app.main import app

    c = TestClient(app)
    r = c.get("/api/setup/status")
    assert r.status_code == 200
    body = r.json()
    assert body["needs_setup"] is True
    assert body["setup_available"] is True


def test_setup_bootstrap_creates_admin() -> None:
    from backend.app.main import app

    c = TestClient(app)
    r = c.post(
        "/api/setup/",
        json={
            "master_password": "pytest_integration_setup_master",
            "username": "setup_admin_u",
            "password": "setup_admin_pw_12",
        },
    )
    assert r.status_code == 201, r.text
    st = c.get("/api/setup/status")
    assert st.json()["needs_setup"] is False


def test_setup_bootstrap_rejects_wrong_master() -> None:
    from backend.app.main import app

    c = TestClient(app)
    r = c.post(
        "/api/setup/",
        json={
            "master_password": "clave-incorrecta",
            "username": "x_admin",
            "password": "setup_admin_pw_12",
        },
    )
    assert r.status_code == 401


def test_register_forbidden_without_admin() -> None:
    from backend.app.main import app

    c = TestClient(app)
    r = c.post("/api/auth/register", json={"username": "solo_user", "password": "pw12345678"})
    assert r.status_code == 403

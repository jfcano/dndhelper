from __future__ import annotations

from fastapi.testclient import TestClient


def test_openapi_json_exposes_core_api_paths() -> None:
    """Contrato mínimo: rutas críticas siguen publicadas en OpenAPI (regresión de prefijos / nombres)."""
    from backend.app.main import app

    c = TestClient(app)
    r = c.get("/openapi.json")
    assert r.status_code == 200
    paths = r.json().get("paths") or {}
    assert "/api/query_rules" in paths
    assert "/api/upload_pdf" in paths
    assert "/api/rag/clear" in paths
    assert "/api/auth/login" in paths
    assert "/api/auth/register" in paths
    assert "/api/setup/status" in paths
    assert "/api/setup/" in paths
    assert "/api/all-sessions" in paths
    assert "/api/settings" in paths

from __future__ import annotations


def test_settings_openai_roundtrip(client) -> None:
    r = client.get("/api/settings")
    assert r.status_code == 200
    body = r.json()
    assert body == {"has_stored_openai_key": False}
    assert "sk-" not in str(body)

    r = client.put("/api/settings/openai", json={"openai_api_key": "sk-test-secret-123"})
    assert r.status_code == 200
    body = r.json()
    assert body["has_stored_openai_key"] is True
    assert "sk-" not in str(body)

    r = client.get("/api/settings")
    assert r.status_code == 200
    assert r.json() == {"has_stored_openai_key": True}

    r = client.delete("/api/settings/openai")
    assert r.status_code == 200
    assert r.json() == {"has_stored_openai_key": False}

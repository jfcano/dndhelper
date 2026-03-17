def test_admin_ui_served(client):
    r = client.get("/admin")
    assert r.status_code == 200
    body = r.text.lower()
    assert "dnd helper" in body
    assert "<html" in body


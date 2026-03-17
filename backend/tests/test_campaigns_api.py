from uuid import uuid4


def test_campaigns_crud(db_client):
    # Create
    r = db_client.post("/api/campaigns", json={"name": "Test campaign", "system": "5e"})
    assert r.status_code == 200
    created = r.json()
    assert created["name"] == "Test campaign"
    cid = created["id"]

    # List
    r = db_client.get("/api/campaigns")
    assert r.status_code == 200
    items = r.json()
    assert any(x["id"] == cid for x in items)

    # Get
    r = db_client.get(f"/api/campaigns/{cid}")
    assert r.status_code == 200
    assert r.json()["id"] == cid

    # Patch
    r = db_client.patch(f"/api/campaigns/{cid}", json={"tone": "grim"})
    assert r.status_code == 200
    assert r.json()["tone"] == "grim"

    # Delete
    r = db_client.delete(f"/api/campaigns/{cid}")
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # Get -> 404
    r = db_client.get(f"/api/campaigns/{cid}")
    assert r.status_code == 404


def test_campaign_get_missing_returns_404(db_client):
    missing = str(uuid4())
    r = db_client.get(f"/api/campaigns/{missing}")
    assert r.status_code == 404


def test_campaign_create_validation_422(db_client):
    r = db_client.post("/api/campaigns", json={})
    assert r.status_code == 422

    r = db_client.post("/api/campaigns", json={"name": ""})
    assert r.status_code == 422


def test_campaign_patch_validation_422(db_client):
    r = db_client.post("/api/campaigns", json={"name": "X"})
    cid = r.json()["id"]

    r = db_client.patch(f"/api/campaigns/{cid}", json={"name": ""})
    assert r.status_code == 422


def test_campaigns_pagination_limit_and_offset(db_client):
    # create 3
    for i in range(3):
        db_client.post("/api/campaigns", json={"name": f"C{i}"})

    r = db_client.get("/api/campaigns?limit=1&offset=0")
    assert r.status_code == 200
    assert len(r.json()) == 1

    r2 = db_client.get("/api/campaigns?limit=1&offset=1")
    assert r2.status_code == 200
    assert len(r2.json()) == 1


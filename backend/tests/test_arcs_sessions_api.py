def _create_campaign(db_client):
    r = db_client.post("/api/campaigns", json={"name": "Camp"})
    assert r.status_code == 200
    return r.json()["id"]


def _create_arc(db_client, campaign_id, title="Arc 1"):
    r = db_client.post(f"/api/campaigns/{campaign_id}/arcs", json={"title": title, "order_index": 0})
    assert r.status_code == 200
    return r.json()["id"]


def test_arcs_crud_and_list(db_client):
    cid = _create_campaign(db_client)

    # list empty
    r = db_client.get(f"/api/campaigns/{cid}/arcs")
    assert r.status_code == 200
    assert r.json() == []

    # create
    r = db_client.post(f"/api/campaigns/{cid}/arcs", json={"title": "Arc A", "summary": "S", "order_index": 1})
    assert r.status_code == 200
    arc = r.json()
    aid = arc["id"]
    assert arc["campaign_id"] == cid
    assert arc["title"] == "Arc A"

    # get
    r = db_client.get(f"/api/arcs/{aid}")
    assert r.status_code == 200

    # patch
    r = db_client.patch(f"/api/arcs/{aid}", json={"title": "Arc B"})
    assert r.status_code == 200
    assert r.json()["title"] == "Arc B"

    # list
    r = db_client.get(f"/api/campaigns/{cid}/arcs")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # delete
    r = db_client.delete(f"/api/arcs/{aid}")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_sessions_nested_under_arc_and_campaign_listing(db_client):
    cid = _create_campaign(db_client)
    aid = _create_arc(db_client, cid)

    # create session
    r = db_client.post(f"/api/arcs/{aid}/sessions", json={"session_number": 1, "title": "S1", "status": "planned"})
    assert r.status_code == 200
    s = r.json()
    sid = s["id"]
    assert s["campaign_id"] == cid
    assert s["arc_id"] == aid

    # list sessions for arc
    r = db_client.get(f"/api/arcs/{aid}/sessions")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # list sessions for campaign
    r = db_client.get(f"/api/campaigns/{cid}/sessions")
    assert r.status_code == 200
    assert len(r.json()) == 1

    # patch session
    r = db_client.patch(f"/api/sessions/{sid}", json={"status": "played", "notes": "ok"})
    assert r.status_code == 200
    assert r.json()["status"] == "played"

    # delete session
    r = db_client.delete(f"/api/sessions/{sid}")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_arc_create_validation(db_client):
    cid = _create_campaign(db_client)
    r = db_client.post(f"/api/campaigns/{cid}/arcs", json={"title": ""})
    assert r.status_code == 422


def test_session_create_validation(db_client):
    cid = _create_campaign(db_client)
    aid = _create_arc(db_client, cid)
    r = db_client.post(f"/api/arcs/{aid}/sessions", json={"title": ""})
    assert r.status_code == 422
    r = db_client.post(f"/api/arcs/{aid}/sessions", json={"session_number": 0, "title": "x"})
    assert r.status_code == 422


def test_arcs_and_sessions_respect_owner_isolation(db_client, monkeypatch):
    owner1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    owner2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

    monkeypatch.setenv("LOCAL_OWNER_UUID", owner1)
    cid = _create_campaign(db_client)
    aid = _create_arc(db_client, cid, title="ArcOwner1")
    r = db_client.post(f"/api/arcs/{aid}/sessions", json={"session_number": 1, "title": "S1", "status": "planned"})
    assert r.status_code == 200
    sid = r.json()["id"]

    # Switch owner -> should not be able to see/access
    monkeypatch.setenv("LOCAL_OWNER_UUID", owner2)
    r = db_client.get(f"/api/campaigns/{cid}/arcs")
    assert r.status_code == 404  # campaign not found for this owner

    r = db_client.get(f"/api/arcs/{aid}")
    assert r.status_code == 404

    r = db_client.get(f"/api/arcs/{aid}/sessions")
    assert r.status_code == 404

    r = db_client.get(f"/api/campaigns/{cid}/sessions")
    assert r.status_code == 404

    r = db_client.get(f"/api/sessions/{sid}")
    assert r.status_code == 404


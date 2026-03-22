from __future__ import annotations

from fastapi.testclient import TestClient


def test_upload_pdf_no_files_returns_400(client) -> None:
    r = client.post("/api/upload_pdf", data={"rag_target": "manuals"})
    assert r.status_code == 400


def test_upload_pdf_invalid_extension_returns_400(client) -> None:
    r = client.post(
        "/api/upload_pdf",
        data={"rag_target": "manuals"},
        files=[("files", ("virus.exe", b"MZ", "application/octet-stream"))],
    )
    assert r.status_code == 400


def test_upload_pdf_bad_pdf_header_returns_400(client) -> None:
    r = client.post(
        "/api/upload_pdf",
        data={"rag_target": "manuals"},
        files=[("files", ("fake.pdf", b"not a pdf", "application/pdf"))],
    )
    assert r.status_code == 400


def test_upload_pdf_for_owner_id_forbidden_for_non_admin(client) -> None:
    from backend.app.main import app

    other = TestClient(app)
    reg = other.post("/api/auth/register", json={"username": "rag_doc_owner_u", "password": "pw12345678"})
    assert reg.status_code == 200
    uid = reg.json()["user"]["id"]

    r = client.post(
        "/api/upload_pdf",
        data={"rag_target": "manuals", "for_owner_id": uid},
        files=[("files", ("ok.pdf", b"%PDF-1.4\n", "application/pdf"))],
    )
    assert r.status_code == 403


def test_upload_pdf_for_owner_id_admin_accepted(admin_client) -> None:
    from backend.app.main import app

    other = TestClient(app)
    reg = other.post("/api/auth/register", json={"username": "rag_doc_target_u", "password": "pw12345678"})
    assert reg.status_code == 200
    uid = reg.json()["user"]["id"]

    r = admin_client.post(
        "/api/upload_pdf",
        data={"rag_target": "manuals", "for_owner_id": uid},
        files=[("files", ("doc.pdf", b"%PDF-1.4\n", "application/pdf"))],
    )
    assert r.status_code == 202
    body = r.json()
    assert body["queued"]
    assert body["queued"][0]["status"] == "queued"


def test_upload_pdf_for_owner_id_invalid_uuid_admin_returns_400(admin_client) -> None:
    r = admin_client.post(
        "/api/upload_pdf",
        data={"rag_target": "manuals", "for_owner_id": "no-es-uuid"},
        files=[("files", ("doc.pdf", b"%PDF-1.4\n", "application/pdf"))],
    )
    assert r.status_code == 400

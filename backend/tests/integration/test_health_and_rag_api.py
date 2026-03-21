from __future__ import annotations

from uuid import uuid4

import pytest


def test_health(client) -> None:
    r = client.get("/health")

    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_query_rules_validates_empty_question(client) -> None:
    r = client.post("/api/query_rules", json={"question": "   "})
    assert r.status_code == 400


def test_list_ingest_jobs_empty(client) -> None:
    r = client.get("/api/ingest_jobs")
    assert r.status_code == 200
    assert r.json() == []


def test_delete_ingest_job_queued_removes_file(client, tmp_path) -> None:
    from backend.app.db import get_sessionmaker
    from backend.app.ingest_job_repo import create_job
    from backend.app.owner_context import get_owner_id

    oid = get_owner_id()
    jid = uuid4()
    pdf = tmp_path / "manual.pdf"
    pdf.write_bytes(b"%PDF-1.4\n")
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        create_job(
            db,
            job_id=jid,
            owner_id=oid,
            original_filename="manual.pdf",
            stored_path=str(pdf.resolve()),
        )

    r = client.delete(f"/api/ingest_jobs/{jid}")
    assert r.status_code == 200
    body = r.json()
    assert body["action"] == "deleted"
    assert body["job_id"] == str(jid)
    assert not pdf.exists()

    listed = client.get("/api/ingest_jobs").json()
    assert all(row["id"] != str(jid) for row in listed)


def test_delete_ingest_job_processing_marks_cancelled(client, tmp_path) -> None:
    from backend.app.db import get_sessionmaker
    from backend.app.ingest_job_repo import create_job
    from backend.app.models import IngestJob
    from backend.app.owner_context import get_owner_id

    oid = get_owner_id()
    jid = uuid4()
    pdf = tmp_path / "run.pdf"
    pdf.write_bytes(b"%PDF-1.4\n")
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        create_job(
            db,
            job_id=jid,
            owner_id=oid,
            original_filename="run.pdf",
            stored_path=str(pdf.resolve()),
        )
        row = db.get(IngestJob, jid)
        assert row is not None
        row.status = "processing"
        db.commit()

    r = client.delete(f"/api/ingest_jobs/{jid}")
    assert r.status_code == 200
    assert r.json()["action"] == "cancel_requested"

    with SessionLocal() as db:
        row = db.get(IngestJob, jid)
        assert row is not None
        assert row.status == "cancelled"
    assert pdf.exists()


def test_delete_ingest_job_wrong_owner_returns_404(client, tmp_path) -> None:
    from backend.app.db import get_sessionmaker
    from backend.app.ingest_job_repo import create_job

    jid = uuid4()
    other_owner = uuid4()
    pdf = tmp_path / "other.pdf"
    pdf.write_bytes(b"%PDF-1.4\n")
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        create_job(
            db,
            job_id=jid,
            owner_id=other_owner,
            original_filename="other.pdf",
            stored_path=str(pdf.resolve()),
        )

    r = client.delete(f"/api/ingest_jobs/{jid}")
    assert r.status_code == 404


def test_requeue_interrupted_processing_jobs() -> None:
    from backend.app.db import get_sessionmaker
    from backend.app.ingest_job_repo import create_job, requeue_interrupted_processing_jobs
    from backend.app.models import IngestJob
    from backend.app.owner_context import get_owner_id

    oid = get_owner_id()
    jid = uuid4()
    SessionLocal = get_sessionmaker()
    with SessionLocal() as db:
        create_job(
            db,
            job_id=jid,
            owner_id=oid,
            original_filename="stub.pdf",
            stored_path="/nonexistent/stub.pdf",
        )
        row = db.get(IngestJob, jid)
        assert row is not None
        row.status = "processing"
        row.progress_percent = 44
        row.phase_label = "Indexando…"
        db.commit()

    with SessionLocal() as db:
        n = requeue_interrupted_processing_jobs(db)
        assert n == 1

    with SessionLocal() as db:
        row = db.get(IngestJob, jid)
        assert row is not None
        assert row.status == "queued"
        assert row.progress_percent == 0
        assert row.phase_label and "reencolado" in row.phase_label.lower()


def test_query_rules_returns_answer_from_rag_mock(client, monkeypatch: pytest.MonkeyPatch) -> None:
    from backend.app.api import rag as rag_api

    def _fake_answer_question(question: str, *, k: int = 4) -> dict:
        assert question
        return {"answer": "Respuesta fake", "sources": [{"source": "x", "page": 1}]}

    monkeypatch.setattr(rag_api, "answer_question", _fake_answer_question)

    r = client.post("/api/query_rules", json={"question": "¿Qué es una tirada de salvación?"})
    assert r.status_code == 200
    body = r.json()
    assert body["answer"] == "Respuesta fake"
    assert isinstance(body["sources"], list)
    assert body["sources"][0]["source"] == "x"


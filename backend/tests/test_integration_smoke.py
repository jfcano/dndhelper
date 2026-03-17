def test_integration_campaigns_and_rag_mock(monkeypatch, db_client):
    # Crear una campaña (usa DB test)
    r = db_client.post("/api/campaigns", json={"name": "Integración"})
    assert r.status_code == 200

    # Mock RAG para que no dependa de LLM/embeddings
    import backend.app.services.rag_service as rag_service

    class _FakeDoc:
        def __init__(self):
            self.page_content = "ctx"
            self.metadata = {"source": "fake.pdf", "page": 1}

    class _Retriever:
        def invoke(self, question: str):
            return [_FakeDoc()]

    class _VS:
        def as_retriever(self, search_kwargs=None):
            return _Retriever()

    class _Resp:
        content = "ok"

    class _LLM:
        def __init__(self, *a, **k):
            pass

        def invoke(self, messages):
            return _Resp()

    monkeypatch.setattr(rag_service, "get_vector_store", lambda: _VS())
    monkeypatch.setattr(rag_service, "ChatOpenAI", _LLM)

    rr = db_client.post("/api/query_rules", json={"question": "hola"})
    assert rr.status_code == 200
    assert rr.json()["answer"] == "ok"


from __future__ import annotations


class _FakeDoc:
    def __init__(self, page_content: str, metadata: dict):
        self.page_content = page_content
        self.metadata = metadata


class _FakeRetriever:
    def invoke(self, question: str):
        return [
            _FakeDoc("Regla fake", {"source": "fake.pdf", "page": 1}),
        ]


class _FakeVectorStore:
    def as_retriever(self, search_kwargs=None):
        return _FakeRetriever()


class _FakeLLMResp:
    content = "Respuesta mock"


class _FakeChatOpenAI:
    def __init__(self, *args, **kwargs):
        pass

    def invoke(self, messages):
        return _FakeLLMResp()


def test_query_rules_returns_answer_and_sources(monkeypatch, client):
    # Mock vector store y LLM para que el test sea determinista y rápido
    import backend.app.services.rag_service as rag_service

    monkeypatch.setattr(rag_service, "get_vector_store", lambda: _FakeVectorStore())
    monkeypatch.setattr(rag_service, "ChatOpenAI", _FakeChatOpenAI)

    r = client.post("/api/query_rules", json={"question": "¿Qué es X?"})
    assert r.status_code == 200
    data = r.json()
    assert data["answer"] == "Respuesta mock"
    assert isinstance(data["sources"], list)
    assert data["sources"][0]["source"] == "fake.pdf"
    assert data["sources"][0]["page"] == 1


def test_query_rules_empty_question_returns_400(client):
    r = client.post("/api/query_rules", json={"question": "   "})
    assert r.status_code == 400


def test_query_rules_no_docs_returns_sources_empty(monkeypatch, client):
    class _EmptyRetriever:
        def invoke(self, question: str):
            return []

    class _VS:
        def as_retriever(self, search_kwargs=None):
            return _EmptyRetriever()

    import backend.app.services.rag_service as rag_service

    monkeypatch.setattr(rag_service, "get_vector_store", lambda: _VS())
    monkeypatch.setattr(rag_service, "ChatOpenAI", _FakeChatOpenAI)

    r = client.post("/api/query_rules", json={"question": "algo"})
    assert r.status_code == 200
    data = r.json()
    assert data["answer"] == "Respuesta mock"
    assert data["sources"] == []


def test_query_rules_missing_metadata_fields(monkeypatch, client):
    class _Retriever:
        def invoke(self, question: str):
            return [_FakeDoc("texto", {})]

    class _VS:
        def as_retriever(self, search_kwargs=None):
            return _Retriever()

    import backend.app.services.rag_service as rag_service

    monkeypatch.setattr(rag_service, "get_vector_store", lambda: _VS())
    monkeypatch.setattr(rag_service, "ChatOpenAI", _FakeChatOpenAI)

    r = client.post("/api/query_rules", json={"question": "algo"})
    assert r.status_code == 200
    data = r.json()
    assert data["sources"][0]["source"] is None
    assert data["sources"][0]["page"] is None


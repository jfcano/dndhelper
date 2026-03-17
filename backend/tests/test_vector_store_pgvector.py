from __future__ import annotations

import os
import uuid

from langchain_core.embeddings import Embeddings


class _FakeEmbeddings(Embeddings):
    """Embeddings deterministas y rápidas para tests."""

    def __init__(self, dim: int = 3) -> None:
        self.dim = dim

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        for t in texts:
            n = float(len(t or ""))
            out.append([n, n + 1.0, n + 2.0][: self.dim])
        return out

    def embed_query(self, text: str) -> list[float]:
        n = float(len(text or ""))
        return [n, n + 1.0, n + 2.0][: self.dim]


def test_pgvector_roundtrip_add_and_search(postgres_test_url, monkeypatch):
    """
    Verifica que podemos:
    - crear un vector store PGVector apuntando al POSTGRES_TEST_URL
    - insertar documentos con embeddings fake
    - recuperar con similarity_search
    """
    # Forzar que get_vector_store use la DB de test
    os.environ["POSTGRES_URL"] = postgres_test_url
    os.environ["POSTGRES_CREATE_EXTENSION"] = "true"
    os.environ["POSTGRES_CONNECT_TIMEOUT_S"] = "5"
    os.environ["RAG_COLLECTION"] = f"test_vs_{uuid.uuid4().hex}"

    import backend.app.vector_store as vs_mod

    monkeypatch.setattr(vs_mod, "get_embeddings", lambda: _FakeEmbeddings())
    vs = vs_mod.get_vector_store()

    vs.add_texts(["hola mundo"], metadatas=[{"source": "t.pdf", "page": 1}])
    docs = vs.similarity_search("hola", k=1)
    assert len(docs) == 1
    assert "hola" in docs[0].page_content.lower()


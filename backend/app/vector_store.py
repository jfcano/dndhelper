from __future__ import annotations

from pathlib import Path

from langchain_community.vectorstores import Chroma

from backend.app.config import get_settings
from backend.app.embeddings import get_embeddings


def get_chroma_persist_dir() -> Path:
    settings = get_settings()
    settings.chroma_persist_dir.mkdir(parents=True, exist_ok=True)
    return settings.chroma_persist_dir


def get_vector_store() -> Chroma:
    settings = get_settings()
    persist_dir = get_chroma_persist_dir()
    embeddings = get_embeddings()

    return Chroma(
        collection_name=settings.default_collection,
        embedding_function=embeddings,
        persist_directory=str(persist_dir),
    )


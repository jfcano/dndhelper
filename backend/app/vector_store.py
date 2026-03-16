from __future__ import annotations

import logging
from pathlib import Path

from langchain_community.vectorstores import Chroma

from backend.app.config import get_settings
from backend.app.embeddings import get_embeddings

logger = logging.getLogger(__name__)


def get_chroma_persist_dir() -> Path:
    settings = get_settings()
    settings.chroma_persist_dir.mkdir(parents=True, exist_ok=True)
    return settings.chroma_persist_dir


def get_vector_store() -> Chroma:
    settings = get_settings()
    persist_dir = get_chroma_persist_dir()
    embeddings = get_embeddings()
    logger.info(
        "vector_store: Chroma collection=%s persist_directory=%s",
        settings.default_collection,
        persist_dir,
    )
    return Chroma(
        collection_name=settings.default_collection,
        embedding_function=embeddings,
        persist_directory=str(persist_dir),
    )


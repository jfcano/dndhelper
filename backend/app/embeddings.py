from __future__ import annotations

from langchain_openai import OpenAIEmbeddings

from backend.app.config import get_settings
from backend.app.openai_key_runtime import get_openai_key_for_llm_and_embeddings


def get_embeddings() -> OpenAIEmbeddings:
    """
    Embeddings por API (OpenAI).
    Configurable con OPENAI_EMBEDDINGS_MODEL (por defecto text-embedding-3-large).
    """
    settings = get_settings()
    api_key = get_openai_key_for_llm_and_embeddings()
    return OpenAIEmbeddings(model=settings.openai_embeddings_model, api_key=api_key)


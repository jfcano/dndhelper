from __future__ import annotations

from langchain_openai import OpenAIEmbeddings

from backend.app.config import get_settings


def get_embeddings() -> OpenAIEmbeddings:
    """
    Embeddings por API (OpenAI).
    Configurable con OPENAI_EMBEDDINGS_MODEL (por defecto text-embedding-3-large).
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("Falta OPENAI_API_KEY en el entorno.")
    return OpenAIEmbeddings(model=settings.openai_embeddings_model, api_key=settings.openai_api_key)


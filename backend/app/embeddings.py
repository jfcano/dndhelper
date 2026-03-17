from __future__ import annotations

from langchain_huggingface import HuggingFaceEmbeddings

from backend.app.config import get_settings


def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Prototipo: BAAI/bge-m3. Por defecto usa CUDA si está disponible.
    Device configurable con EMBEDDINGS_DEVICE (cuda/cpu). Firma estable para cambiar de modelo más adelante.
    """
    settings = get_settings()
    return HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={"device": settings.embeddings_device},
        encode_kwargs={"normalize_embeddings": True},
    )


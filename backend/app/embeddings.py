from __future__ import annotations

from langchain_community.embeddings import HuggingFaceEmbeddings


def get_embeddings() -> HuggingFaceEmbeddings:
    """
    Prototipo: BAAI/bge-m3 en CPU.
    La idea es mantener esta firma estable para cambiar de modelo más adelante.
    """
    return HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


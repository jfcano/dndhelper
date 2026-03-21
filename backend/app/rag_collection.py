from __future__ import annotations

from uuid import UUID


def rag_manuals_collection_for_owner(owner_id: UUID) -> str:
    """
    Colección PGVector para manuales subidos, fichas y consultas de reglas.
    """
    return f"rag_u_{owner_id.hex}_manuals"


def rag_campaign_refs_collection_for_owner(owner_id: UUID) -> str:
    """
    Colección para material de campaña indexado (actividad generativa y consultas amplias).
    """
    return f"rag_u_{owner_id.hex}_campaign"


def rag_collection_name_for_owner(owner_id: UUID) -> str:
    """Alias retrocompatible: equivale a la colección de manuales."""
    return rag_manuals_collection_for_owner(owner_id)

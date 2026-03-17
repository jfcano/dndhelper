from __future__ import annotations

import logging

from langchain_postgres import PGVector

from backend.app.config import get_settings
from backend.app.embeddings import get_embeddings

logger = logging.getLogger(__name__)


def get_vector_store() -> PGVector:
    settings = get_settings()
    embeddings = get_embeddings()
    if not settings.postgres_url:
        raise RuntimeError("Falta POSTGRES_URL en el entorno.")

    logger.info("vector_store: PGVector collection=%s", settings.default_collection)
    return PGVector(
        embeddings=embeddings,
        collection_name=settings.default_collection,
        connection=settings.postgres_url,
        use_jsonb=True,
        create_extension=settings.postgres_create_extension,
        engine_args={
            "connect_args": {"connect_timeout": settings.postgres_connect_timeout_s},
            "pool_pre_ping": True,
        },
    )


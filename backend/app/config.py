from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    project_root: Path
    data_dir: Path  # carpeta por defecto para PDFs (p. ej. backend/data)
    postgres_url: str | None  # postgresql+psycopg://user:pass@host:port/db
    postgres_connect_timeout_s: int
    postgres_create_extension: bool
    default_collection: str
    openai_api_key: str | None
    openai_model: str
    openai_embeddings_model: str
    chunk_size: int
    chunk_overlap: int
    embeddings_device: str  # "cuda" o "cpu"


def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env")
    data_dir = project_root / "backend" / "data"

    return Settings(
        project_root=project_root,
        data_dir=data_dir,
        postgres_url=os.getenv("POSTGRES_URL"),
        postgres_connect_timeout_s=int(os.getenv("POSTGRES_CONNECT_TIMEOUT_S", "10")),
        postgres_create_extension=os.getenv("POSTGRES_CREATE_EXTENSION", "true").strip().lower() in ("1", "true", "yes", "y", "on"),
        default_collection=os.getenv("RAG_COLLECTION", "rules_5e"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        openai_embeddings_model=os.getenv("OPENAI_EMBEDDINGS_MODEL", "text-embedding-3-large"),
        chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "1200")),
        chunk_overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "200")),
        embeddings_device=os.getenv("EMBEDDINGS_DEVICE", "cuda"),
    )


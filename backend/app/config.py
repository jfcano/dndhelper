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
    jwt_secret: str
    jwt_expire_minutes: int
    admin_username: str | None
    admin_password: str | None
    setup_master_password: str | None  # instalación vía UI; obligatoria si no hay ADMIN_* ni admin en BD
    openai_model: str
    openai_image_model: str
    world_image_generation_enabled: bool
    openai_embeddings_model: str
    chunk_size: int
    chunk_overlap: int
    embeddings_device: str  # "cuda" o "cpu"
    ingest_worker_autostart: bool  # si True, uvicorn lanza proceso(s) ingest_worker
    ingest_worker_count: int  # número de subprocesos ingest_worker (1 por defecto; 0 = ninguno)


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
        jwt_secret=os.getenv("JWT_SECRET", "dev-cambiar-en-produccion-jwt-secret"),
        jwt_expire_minutes=int(os.getenv("JWT_EXPIRE_MINUTES", "10080")),
        admin_username=os.getenv("ADMIN_USERNAME", "").strip() or None,
        admin_password=os.getenv("ADMIN_PASSWORD", "").strip() or None,
        setup_master_password=os.getenv("SETUP_MASTER_PASSWORD", "").strip() or None,
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        openai_image_model=os.getenv("OPENAI_IMAGE_MODEL", "dall-e-3"),
        world_image_generation_enabled=os.getenv("WORLD_IMAGE_GENERATION", "true").strip().lower()
        in ("1", "true", "yes", "y", "on"),
        openai_embeddings_model=os.getenv("OPENAI_EMBEDDINGS_MODEL", "text-embedding-3-large"),
        chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "1200")),
        chunk_overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "200")),
        embeddings_device=os.getenv("EMBEDDINGS_DEVICE", "cuda"),
        ingest_worker_autostart=os.getenv("INGEST_WORKER_AUTOSTART", "true").strip().lower()
        in ("1", "true", "yes", "y", "on"),
        ingest_worker_count=max(
            0,
            min(int(os.getenv("INGEST_WORKER_COUNT", "1")), 32),
        ),
    )


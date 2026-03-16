from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    project_root: Path
    chroma_persist_dir: Path
    default_collection: str
    openai_api_key: str | None
    openai_model: str
    chunk_size: int
    chunk_overlap: int


def get_settings() -> Settings:
    project_root = Path(__file__).resolve().parents[2]
    chroma_persist_dir = project_root / "backend" / "storage" / "chroma_rules"

    return Settings(
        project_root=project_root,
        chroma_persist_dir=chroma_persist_dir,
        default_collection=os.getenv("RAG_COLLECTION", "rules_5e"),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        chunk_size=int(os.getenv("RAG_CHUNK_SIZE", "1200")),
        chunk_overlap=int(os.getenv("RAG_CHUNK_OVERLAP", "200")),
    )


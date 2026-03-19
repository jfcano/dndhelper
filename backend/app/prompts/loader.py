from __future__ import annotations

from functools import lru_cache
from pathlib import Path


_TEMPLATES_DIR = Path(__file__).resolve().parents[2] / "prompt_templates"


@lru_cache(maxsize=64)
def load_prompt_template(name: str) -> str:
    path = _TEMPLATES_DIR / name
    return path.read_text(encoding="utf-8")


def render_prompt_template(name: str, replacements: dict[str, str]) -> str:
    text = load_prompt_template(name)
    for key, value in replacements.items():
        text = text.replace(key, value)
    return text

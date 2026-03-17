from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from langchain_openai import ChatOpenAI

from backend.app.config import get_settings
from backend.app.prompts.campaign_generation import (
    arcs_prompt_es,
    outline_prompt_es,
    sessions_prompt_es,
    system_rules_es,
    world_from_description_prompt_es,
    world_prompt_es,
)


@dataclass(frozen=True)
class GeneratedWorld:
    name: str
    tone: str | None
    pitch: str | None
    themes: dict | None
    draft: dict


@dataclass(frozen=True)
class GeneratedOutline:
    campaign_title: str | None
    raw: dict


@dataclass(frozen=True)
class GeneratedWorldFromDescription:
    name: str
    tone: str | None
    pitch: str | None
    themes: dict | None
    content_draft: str


def _get_llm() -> ChatOpenAI:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("Falta OPENAI_API_KEY en el entorno.")
    return ChatOpenAI(model=settings.openai_model, api_key=settings.openai_api_key, temperature=0.7)


def _parse_json(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        # Intento mínimo: recortar a la primera/última llave (salidas con ruido)
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise ValueError("El modelo no devolvió JSON válido.") from e


def generate_world(*, brief: dict) -> GeneratedWorld:
    llm = _get_llm()
    messages = [
        ("system", system_rules_es()),
        ("user", world_prompt_es(brief=brief)),
    ]
    raw = _parse_json(llm.invoke(messages).content)
    return GeneratedWorld(
        name=str(raw.get("name") or "Nuevo mundo"),
        tone=raw.get("tone"),
        pitch=raw.get("pitch"),
        themes=raw.get("themes"),
        draft=raw.get("draft") if isinstance(raw.get("draft"), dict) else raw,
    )


def generate_world_from_description(*, description: str) -> GeneratedWorldFromDescription:
    llm = _get_llm()
    messages = [
        ("system", system_rules_es()),
        ("user", world_from_description_prompt_es(description=description)),
    ]
    raw = _parse_json(llm.invoke(messages).content)

    content = raw.get("content_draft")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Salida inválida: falta 'content_draft' como texto.")

    return GeneratedWorldFromDescription(
        name=str(raw.get("name") or "Nuevo mundo"),
        tone=raw.get("tone"),
        pitch=raw.get("pitch"),
        themes=raw.get("themes"),
        content_draft=content,
    )


def generate_outline(*, brief: dict, world: dict) -> GeneratedOutline:
    llm = _get_llm()
    messages = [
        ("system", system_rules_es()),
        ("user", outline_prompt_es(brief=brief, world=world)),
    ]
    raw = _parse_json(llm.invoke(messages).content)
    return GeneratedOutline(campaign_title=raw.get("campaign_title"), raw=raw)


def generate_arcs(*, outline: dict, arc_count: int) -> list[dict]:
    llm = _get_llm()
    messages = [
        ("system", system_rules_es()),
        ("user", arcs_prompt_es(outline=outline, arc_count=arc_count)),
    ]
    raw = _parse_json(llm.invoke(messages).content)
    arcs = raw.get("arcs")
    if not isinstance(arcs, list):
        raise ValueError("Salida inválida: falta 'arcs' como lista.")
    return [a for a in arcs if isinstance(a, dict)]


def generate_sessions(
    *,
    arc: dict,
    outline: dict,
    session_count: int,
    starting_session_number: int,
) -> list[dict]:
    llm = _get_llm()
    messages = [
        ("system", system_rules_es()),
        ("user", sessions_prompt_es(
            arc=arc,
            outline=outline,
            session_count=session_count,
            starting_session_number=starting_session_number,
        )),
    ]
    raw = _parse_json(llm.invoke(messages).content)
    sessions = raw.get("sessions")
    if not isinstance(sessions, list):
        raise ValueError("Salida inválida: falta 'sessions' como lista.")
    return [s for s in sessions if isinstance(s, dict)]


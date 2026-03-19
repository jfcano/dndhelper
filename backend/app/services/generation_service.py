from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from langchain_openai import ChatOpenAI

from backend.app.config import get_settings
from backend.app.prompts.loader import render_prompt_template
from backend.app.services.rag_service import answer_question
from backend.app.prompts.campaign_generation import (
    arcs_prompt_es,
    outline_prompt_es,
    sessions_prompt_es,
    system_rules_es,
    world_from_description_prompt_es,
    world_from_wizard_prompt_es,
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


def _as_str_default(value: Any, *, default: str) -> str:
    text = str(value).strip() if value is not None else ""
    if not text:
        text = default
    return text


def _as_opt_str(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text


def _clean_text(value: Any, *, default: str) -> str:
    text = str(value).strip() if value is not None else ""
    return text or default


def _world_flavor(wizard: dict[str, Any]) -> str:
    theme = wizard.get("theme_and_mood")
    if isinstance(theme, str):
        cleaned = theme.strip()
        if cleaned:
            return cleaned[:160]
    return "fantasía de aventura con tensiones políticas y misterios antiguos"


def _normalize_factions(items: list[dict], *, flavor: str) -> list[dict]:
    cleaned: list[dict] = []
    seen: set[str] = set()
    for raw in items:
        if not isinstance(raw, dict):
            continue
        name = _clean_text(raw.get("name"), default="")
        objective = _clean_text(raw.get("objective"), default="")
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(
            {
                "name": name,
                "objective": objective or f"Expandir la influencia de {name} dentro de un mundo de {flavor}.",
            }
        )
    while len(cleaned) < 5:
        idx = len(cleaned) + 1
        name = f"Facción {idx}"
        cleaned.append(
            {
                "name": name,
                "objective": f"Consolidar poder y recursos en su territorio ({idx}) en un contexto de {flavor}.",
            }
        )
    return cleaned[:10]


def _normalize_characters(items: list[dict], faction_names: list[str], *, flavor: str) -> list[dict]:
    per_faction: dict[str, list[dict]] = {f: [] for f in faction_names}
    faction_lookup = {f.lower(): f for f in faction_names}
    for raw in items:
        if not isinstance(raw, dict):
            continue
        faction_raw = _clean_text(raw.get("faction_name"), default="")
        if not faction_raw:
            continue
        faction_key = faction_lookup.get(faction_raw.lower())
        if not faction_key:
            continue
        entry = {
            "name": _clean_text(raw.get("name"), default=f"Agente de {faction_key}"),
            "faction_name": faction_key,
            "role": _clean_text(raw.get("role"), default="Operativo clave"),
            "motivation": _clean_text(
                raw.get("motivation"),
                default=f"Servir los intereses de {faction_key} en un entorno de {flavor}.",
            ),
        }
        per_faction[faction_key].append(entry)

    normalized: list[dict] = []
    for faction_name in faction_names:
        group = per_faction.get(faction_name, [])
        if len(group) > 5:
            group = group[:5]
        while len(group) < 4:
            idx = len(group) + 1
            group.append(
                {
                    "name": f"{faction_name} - Figura {idx}",
                    "faction_name": faction_name,
                    "role": "Actor relevante",
                    "motivation": f"Impulsar la agenda principal de {faction_name} en un mundo de {flavor}.",
                }
            )
        normalized.extend(group)
    return normalized


def _normalize_cities(items: list[dict], *, flavor: str) -> list[dict]:
    cleaned: list[dict] = []
    seen: set[str] = set()
    for raw in items:
        if not isinstance(raw, dict):
            continue
        name = _clean_text(raw.get("name"), default="")
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        relations_raw = raw.get("relations")
        relations: list[str] = []
        if isinstance(relations_raw, list):
            relations = [str(r).strip() for r in relations_raw if str(r).strip()]
        cleaned.append(
            {
                "name": name,
                "theme": _clean_text(raw.get("theme"), default=f"Núcleo regional marcado por {flavor}."),
                "relations": relations[:10],
            }
        )
    while len(cleaned) < 5:
        idx = len(cleaned) + 1
        cleaned.append(
            {
                "name": f"Ciudad {idx}",
                "theme": f"Centro urbano en crecimiento, influido por {flavor}.",
                "relations": ["Intercambio tenso y alianzas frágiles con asentamientos vecinos."],
            }
        )
    return cleaned[:10]


def _wizard_canon_markdown(
    *,
    theme_and_mood: str,
    factions: list[dict],
    characters: list[dict],
    cities: list[dict],
) -> str:
    lines: list[str] = [
        "## Canon de entrada del wizard (sin omisiones)",
        "",
        "### Tematica general",
        theme_and_mood.strip() or "(sin contenido)",
        "",
        "### Facciones (entrada completa)",
    ]
    if factions:
        for idx, faction in enumerate(factions, start=1):
            name = _clean_text(faction.get("name"), default=f"Faccion {idx}") if isinstance(faction, dict) else f"Faccion {idx}"
            objective = (
                _clean_text(faction.get("objective"), default="(sin objetivo)") if isinstance(faction, dict) else "(sin objetivo)"
            )
            lines.append(f"- {name}: {objective}")
    else:
        lines.append("- (sin facciones)")

    lines.extend(["", "### Personajes (entrada completa)"])
    if characters:
        for idx, character in enumerate(characters, start=1):
            if isinstance(character, dict):
                name = _clean_text(character.get("name"), default=f"Personaje {idx}")
                faction_name = _clean_text(character.get("faction_name"), default="(sin faccion)")
                role = _clean_text(character.get("role"), default="(sin rol)")
                motivation = _clean_text(character.get("motivation"), default="(sin motivacion)")
            else:
                name, faction_name, role, motivation = f"Personaje {idx}", "(sin faccion)", "(sin rol)", "(sin motivacion)"
            lines.append(f"- {name} | Faccion: {faction_name} | Rol: {role} | Motivacion: {motivation}")
    else:
        lines.append("- (sin personajes)")

    lines.extend(["", "### Ciudades y pueblos (entrada completa)"])
    if cities:
        for idx, city in enumerate(cities, start=1):
            if isinstance(city, dict):
                name = _clean_text(city.get("name"), default=f"Asentamiento {idx}")
                theme = _clean_text(city.get("theme"), default="(sin tematica)")
                relations_raw = city.get("relations")
                relations: list[str] = []
                if isinstance(relations_raw, list):
                    relations = [str(r).strip() for r in relations_raw if str(r).strip()]
            else:
                name, theme, relations = f"Asentamiento {idx}", "(sin tematica)", []
            relation_text = "; ".join(relations) if relations else "(sin relaciones)"
            lines.append(f"- {name} | Tematica: {theme} | Relaciones: {relation_text}")
    else:
        lines.append("- (sin ciudades)")

    return "\n".join(lines).strip()


def _merge_world_content_with_wizard_input(
    *,
    content_draft: str,
    theme_and_mood: str,
    factions: list[dict],
    characters: list[dict],
    cities: list[dict],
) -> str:
    canon = _wizard_canon_markdown(
        theme_and_mood=theme_and_mood,
        factions=factions,
        characters=characters,
        cities=cities,
    )
    base = content_draft.strip()
    if "## Canon de entrada del wizard (sin omisiones)" in base:
        return base
    return f"{base}\n\n---\n\n{canon}"


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
        name=_as_str_default(raw.get("name"), default="Nuevo mundo"),
        tone=_as_opt_str(raw.get("tone")),
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
        name=_as_str_default(raw.get("name"), default="Nuevo mundo"),
        tone=_as_opt_str(raw.get("tone")),
        pitch=raw.get("pitch"),
        themes=raw.get("themes"),
        content_draft=content,
    )


def generate_world_from_wizard(
    *,
    theme_and_mood: str,
    factions: list[dict],
    characters: list[dict],
    cities: list[dict],
) -> GeneratedWorldFromDescription:
    llm = _get_llm()
    messages = [
        ("system", system_rules_es()),
        (
            "user",
            world_from_wizard_prompt_es(
                theme_and_mood=theme_and_mood,
                factions=factions,
                characters=characters,
                cities=cities,
            ),
        ),
    ]
    raw = _parse_json(llm.invoke(messages).content)

    content = raw.get("content_draft")
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Salida inválida: falta 'content_draft' como texto.")

    merged_content = _merge_world_content_with_wizard_input(
        content_draft=content,
        theme_and_mood=theme_and_mood,
        factions=factions,
        characters=characters,
        cities=cities,
    )

    return GeneratedWorldFromDescription(
        name=_as_str_default(raw.get("name"), default="Nuevo mundo"),
        tone=_as_opt_str(raw.get("tone")),
        pitch=raw.get("pitch"),
        themes=raw.get("themes"),
        content_draft=merged_content,
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


def autogenerate_world_wizard_step(*, step: int, wizard: dict[str, Any]) -> dict[str, Any]:
    step_map = {
        0: "theme_and_mood",
        1: "factions",
        2: "characters",
        3: "cities",
    }
    if step not in step_map:
        raise ValueError("Paso inválido para autogeneración.")

    step_label = step_map[step]
    step_file_map = {
        0: "world_wizard_1.txt",
        1: "world_wizard_2.txt",
        2: "world_wizard_3.txt",
        3: "world_wizard_4.txt",
    }
    template_name = step_file_map[step]

    # Reutilizamos el template del paso para formular una consulta breve de recuperación.
    question = render_prompt_template(
        template_name,
        {
            "__STEP__": str(step + 1),
            "__STEP_LABEL__": step_label,
            "__WIZARD_JSON__": json.dumps(wizard, ensure_ascii=False, indent=2),
            "__RAG_CONTEXT_JSON__": "",
            "__OUTPUT_HINT_JSON__": "{}",
        },
    )[:1500]
    rag = answer_question(question, k=6)
    rag_context = {
        "answer": rag.get("answer", ""),
        "sources": rag.get("sources", []),
    }

    output_hints = {
        0: {"theme_and_mood": "Texto breve y jugable (2-5 frases) con tono/ambiente."},
        1: {
            "factions": [{"name": "Nombre de facción", "objective": "Objetivo concreto"}],
            "constraints": {"min_factions": 5},
        },
        2: {
            "characters": [
                {
                    "name": "Nombre personaje",
                    "faction_name": "Nombre exacto de facción existente",
                    "role": "Rol",
                    "motivation": "Motivación clara",
                }
            ],
            "constraints": {"per_faction_min": 4, "per_faction_max": 5},
        },
        3: {
            "cities": [
                {
                    "name": "Nombre de ciudad",
                    "theme": "Temática",
                    "relations": ["Relación con otra ciudad/facción"],
                }
            ],
            "constraints": {"min_cities": 5, "max_cities": 10},
        },
    }

    llm = _get_llm()
    model_prompt = render_prompt_template(
        template_name,
        {
            "__STEP__": str(step + 1),
            "__STEP_LABEL__": step_label,
            "__RAG_CONTEXT_JSON__": json.dumps(rag_context, ensure_ascii=False, indent=2),
            "__WIZARD_JSON__": json.dumps(wizard, ensure_ascii=False, indent=2),
            "__OUTPUT_HINT_JSON__": json.dumps(output_hints[step], ensure_ascii=False, indent=2),
        },
    )
    messages = [
        ("system", system_rules_es()),
        ("user", model_prompt),
    ]
    raw = _parse_json(llm.invoke(messages).content)
    flavor = _world_flavor(wizard)

    if step == 0:
        text = raw.get("theme_and_mood")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Autogeneración inválida para step 0.")
        return {"theme_and_mood": text}
    if step == 1:
        factions = raw.get("factions")
        if not isinstance(factions, list) or not factions:
            raise ValueError("Autogeneración inválida para step 1.")
        return {"factions": _normalize_factions([f for f in factions if isinstance(f, dict)], flavor=flavor)}
    if step == 2:
        characters = raw.get("characters")
        if not isinstance(characters, list) or not characters:
            raise ValueError("Autogeneración inválida para step 2.")
        wizard_factions = wizard.get("factions")
        faction_names: list[str] = []
        if isinstance(wizard_factions, list):
            for faction in wizard_factions:
                if not isinstance(faction, dict):
                    continue
                name = _clean_text(faction.get("name"), default="")
                if name and name not in faction_names:
                    faction_names.append(name)
        if not faction_names:
            faction_names = [f["name"] for f in _normalize_factions([], flavor=flavor)]
        return {
            "characters": _normalize_characters(
                [c for c in characters if isinstance(c, dict)],
                faction_names,
                flavor=flavor,
            )
        }
    cities = raw.get("cities")
    if not isinstance(cities, list) or not cities:
        raise ValueError("Autogeneración inválida para step 3.")
    return {"cities": _normalize_cities([c for c in cities if isinstance(c, dict)], flavor=flavor)}


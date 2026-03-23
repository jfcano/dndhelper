from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from langchain_openai import ChatOpenAI

from backend.app.config import get_settings
from backend.app.openai_key_runtime import get_openai_key_for_llm_and_embeddings
from backend.app.owner_context import get_owner_id
from backend.app.prompts.loader import render_prompt_template
from backend.app.rag_collection import rag_campaign_refs_collection_for_owner, rag_manuals_collection_for_owner
from backend.app.services.rag_service import answer_question
from backend.app.prompts.campaign_generation import (
    campaign_players_prompt_es,
    session_extend_prompt_es,
    campaign_wizard_step_prompt_es,
    campaign_story_draft_prompt_es,
    campaign_story_markdown_system_rules_es,
    outline_prompt_es,
    sessions_prompt_es,
    system_rules_es,
    world_from_description_prompt_es,
    world_from_wizard_prompt_es,
    world_prompt_es,
)


def _rag_manuals_answer(question: str, *, k: int = 6) -> dict:
    coll = rag_manuals_collection_for_owner(get_owner_id())
    return answer_question(question, collection_name=coll, k=k)


def _rag_campaign_answer(question: str, *, k: int = 6) -> dict:
    coll = rag_campaign_refs_collection_for_owner(get_owner_id())
    return answer_question(question, collection_name=coll, k=k)


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


def suggest_campaign_name(*, brief: dict, world: dict) -> str:
    """
    Sugiere un nombre para la campaña basándose en el brief y el mundo.
    - Heurística determinista (evita depender de una llamada extra a LLM en MVP).
    - El usuario siempre podrá editar el nombre desde la UI.
    """
    def _smart_title(s: str) -> str:
        txt = (s or "").strip()
        if not txt:
            return txt
        # Si parece un acrónimo (todas mayúsculas), lo dejamos tal cual.
        if txt.isupper():
            return txt

        parts = txt.split(' ')
        titled: list[str] = []
        for p in parts:
            if not p:
                continue
            if not any(ch.isalpha() for ch in p):
                titled.append(p)
                continue
            titled.append(p[0].upper() + p[1:].lower())
        return ' '.join(titled).strip()

    world_name = _smart_title(str(world.get("name") or "").strip() or "Mundo")

    kind = _smart_title(str(brief.get("kind") or "").strip())
    tone = _smart_title(str(brief.get("tone") or "").strip())

    themes_raw = brief.get("themes")
    themes: list[str] = []
    if isinstance(themes_raw, list):
        themes = [str(t).strip() for t in themes_raw if str(t).strip()]

    theme = _smart_title(themes[0]) if themes else ""

    base_parts: list[str] = []
    if theme:
        base_parts.append(theme)
    elif kind:
        base_parts.append(kind)

    if tone and tone not in base_parts:
        base_parts.append(tone)

    base = " ".join(base_parts).strip() or (kind or "Campaña")

    # Mantenerlo razonablemente corto para UI.
    suggested = f"{base} ({world_name})"
    return suggested[:90].rstrip()


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
            "gender": _clean_text(raw.get("gender"), default=""),
            "appearance": _clean_text(raw.get("appearance"), default=""),
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
                    "gender": "",
                    "appearance": "",
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
                gender = _clean_text(character.get("gender"), default="")
                appearance = _clean_text(character.get("appearance"), default="")
            else:
                name, faction_name, role, motivation = f"Personaje {idx}", "(sin faccion)", "(sin rol)", "(sin motivacion)"
                gender, appearance = "", ""
            vis = f" | Genero/presentacion: {gender or '(no indicado)'} | Apariencia: {appearance or '(no indicada)'}"
            lines.append(f"- {name} | Faccion: {faction_name} | Rol: {role} | Motivacion: {motivation}{vis}")
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
    api_key = get_openai_key_for_llm_and_embeddings()
    return ChatOpenAI(model=settings.openai_model, api_key=api_key, temperature=0.7)


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


def generate_campaign_story_draft(*, brief: dict, world: dict) -> str:
    """
    Genera el resumen narrativo en Markdown (borrador editable) a partir del wizard.
    - Usa RAG+LLM para contextualizar el tono/reglas/lore
    - Ambientado en el contenido del mundo proporcionado
    """
    llm = _get_llm()

    world_name = str(world.get("name") or "Mundo")
    world_content = str(world.get("content_final") or world.get("content_draft") or world.get("content") or "").strip()
    # Limitamos el fragmento para evitar prompts gigantes.
    world_content_snippet = world_content[:6000]

    # Pregunta corta para recuperación de contexto relevante.
    rag_question = (
        "Necesito contexto lore/reglas y referencias para escribir un resumen narrativo de una campaña. "
        f"tipo={brief.get('kind')}, tono={brief.get('tone')}, temas={brief.get('themes')}, nivel_inicial={brief.get('starting_level')}. "
        f"Mundo={world_name}. "
        "Incluye ideas coherentes con restricciones definidas en brief.constraints.notes si existen. "
        "Devuelve contexto que ayude a redactar secciones de historia para un DM."
    )
    rag = _rag_campaign_answer(rag_question, k=6)
    rag_context = {
        "answer": rag.get("answer", ""),
        "sources": rag.get("sources", []),
    }

    prompt = campaign_story_draft_prompt_es(
        world_name=world_name,
        world_content=world_content_snippet,
        brief=brief,
        rag_context=rag_context,
    )

    messages = [
        ("system", campaign_story_markdown_system_rules_es()),
        ("user", prompt),
    ]
    story = getattr(llm.invoke(messages), "content", "")
    story_text = str(story).strip()
    if not story_text:
        raise ValueError("Salida inválida: falta el texto del resumen en Markdown.")
    return story_text


def generate_sessions(
    *,
    story_md: str,
    session_count: int,
    starting_session_number: int,
) -> list[dict]:
    llm = _get_llm()
    story_md_snippet = str(story_md or "").strip()[:12000]
    base_prompt = sessions_prompt_es(
        story_md=story_md_snippet,
        session_count=session_count,
        starting_session_number=starting_session_number,
    )
    messages = [
        ("system", system_rules_es()),
        ("user", base_prompt),
    ]
    try:
        raw = _parse_json(llm.invoke(messages).content)
    except ValueError:
        # Reintento único con instrucción explícita de JSON estricto.
        strict_messages = [
            ("system", system_rules_es()),
            (
                "user",
                base_prompt
                + "\n\nIMPORTANTE: responde SOLO con JSON válido, sin comentarios, sin markdown y sin comas finales.",
            ),
        ]
        raw = _parse_json(llm.invoke(strict_messages).content)
    sessions = raw.get("sessions")
    if not isinstance(sessions, list):
        raise ValueError("Salida inválida: falta 'sessions' como lista.")
    return [s for s in sessions if isinstance(s, dict)]


def generate_player_characters(*, brief: dict, player_count: int) -> list[dict]:
    def _normalize_basic_sheet_keys(value: Any) -> Any:
        key_map = {
            "class": "clase",
            "subclass": "subclase",
            "species": "especie",
            "race": "especie",
            "background": "trasfondo",
            "alignment_hint": "tendencia_sugerida",
            "alignment": "tendencia_sugerida",
            "level": "nivel",
            "hooks": "ganchos",
            "party_role": "rol_en_grupo",
            "role_in_party": "rol_en_grupo",
        }
        if isinstance(value, list):
            return [_normalize_basic_sheet_keys(v) for v in value]
        if isinstance(value, dict):
            out: dict[str, Any] = {}
            for k, v in value.items():
                k_str = str(k).strip()
                mapped = key_map.get(k_str.lower(), k_str)
                out[mapped] = _normalize_basic_sheet_keys(v)
            return out
        return value

    llm = _get_llm()
    safe_count = max(1, min(int(player_count), 8))
    rag = _rag_manuals_answer(
        "Resume reglas D&D 5e aplicables a creación de personajes jugadores: atributos, clase, trasfondo, equipo inicial.",
        k=5,
    )
    rag_prefix = (
        "Contexto recuperado de manuales/reglas (RAG):\n"
        f"{str(rag.get('answer', '') or '').strip()[:6000]}\n\n"
        if str(rag.get("answer", "") or "").strip()
        else ""
    )
    messages = [
        ("system", system_rules_es()),
        ("user", rag_prefix + campaign_players_prompt_es(brief=brief, player_count=safe_count)),
    ]
    raw = _parse_json(llm.invoke(messages).content)
    players = raw.get("players")
    if not isinstance(players, list):
        raise ValueError("Salida invalida: falta 'players' como lista.")
    normalized: list[dict] = []
    for p in players:
        if not isinstance(p, dict):
            continue
        out = dict(p)
        out["name"] = str(p.get("name") or "").strip() or "Jugador"
        out["summary"] = str(p.get("summary") or "").strip()
        out["basic_sheet"] = _normalize_basic_sheet_keys(p.get("basic_sheet"))
        normalized.append(out)
    return normalized


def extend_session_markdown(
    *,
    campaign_story_md: str,
    session_title: str,
    session_summary: str,
    session_draft_md: str,
) -> str:
    llm = _get_llm()
    prompt = session_extend_prompt_es(
        campaign_story_md=str(campaign_story_md or "")[:12000],
        session_title=str(session_title or "")[:300],
        session_summary=str(session_summary or "")[:4000],
        session_draft_md=str(session_draft_md or "")[:12000],
    )
    messages = [
        ("system", campaign_story_markdown_system_rules_es()),
        ("user", prompt),
    ]
    out = getattr(llm.invoke(messages), "content", "")
    md = str(out).strip()
    if not md:
        raise ValueError("Salida invalida: markdown vacio al extender sesion.")
    return md


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
    rag = _rag_campaign_answer(question, k=6)
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
                    "gender": "mujer / hombre / no binario / otro (para retratos)",
                    "appearance": "edad aparente, rasgos, vestimenta icónica (breve, para ilustración)",
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


def _campaign_clean_list(values: Any, *, default: str) -> list[str]:
    if not isinstance(values, list):
        return [default]
    cleaned = [str(v).strip() for v in values if str(v).strip()]
    return cleaned or [default]


def _normalize_campaign_constraints(constraints: Any) -> dict[str, str]:
    """
    El UI solo edita `constraints.notes` (texto libre con espacios).
    Si el modelo devuelve un dict sin `notes` o con claves auxiliares, las volcamos a un único texto.
    """
    default_notes = "Sin restricciones especiales indicadas."
    if constraints is None:
        return {"notes": default_notes}
    if isinstance(constraints, str):
        s = constraints.strip()
        return {"notes": s if s else default_notes}
    if not isinstance(constraints, dict):
        return {"notes": default_notes}

    notes_raw = constraints.get("notes")
    if isinstance(notes_raw, str) and notes_raw.strip():
        return {"notes": notes_raw}

    lines: list[str] = []
    for k, v in sorted(constraints.items()):
        if k == "notes":
            continue
        if isinstance(v, (dict, list)):
            try:
                blob = json.dumps(v, ensure_ascii=False)
            except (TypeError, ValueError):
                blob = str(v)
            lines.append(f"{k}: {blob}")
        else:
            vs = str(v).strip()
            if vs:
                lines.append(f"{k}: {vs}")
    composed = "\n".join(lines).strip()
    if composed:
        return {"notes": composed}
    if isinstance(notes_raw, str):
        return {"notes": notes_raw if notes_raw else default_notes}
    return {"notes": default_notes}


def autogenerate_campaign_wizard_step(*, step: int, wizard: dict[str, Any]) -> dict[str, Any]:
    step_map = {
        0: "tipo y tono",
        1: "temas principales",
        2: "nivel inicial y restricciones",
        3: "inspiraciones",
    }
    if step not in step_map:
        raise ValueError("Paso inválido para autogeneración.")

    output_hints = {
        0: {
            "kind": "tipo de campaña",
            "tone": "tono de campaña",
        },
        1: {
            "themes": ["tema 1", "tema 2", "tema 3"],
        },
        2: {
            "starting_level": 1,
            "constraints": {"notes": "restricciones y límites de mesa"},
        },
        3: {
            "inspirations": ["inspiración 1", "inspiración 2"],
        },
    }

    step_number = step + 1
    rag_question = campaign_wizard_step_prompt_es(
        step=step_number,
        step_label=step_map[step],
        wizard=wizard,
        rag_context={},
        output_hint={"note": "Consulta breve para recuperación"},
    )[:1500]
    rag = _rag_campaign_answer(rag_question, k=6)
    rag_context = {
        "answer": rag.get("answer", ""),
        "sources": rag.get("sources", []),
    }

    llm = _get_llm()
    prompt = campaign_wizard_step_prompt_es(
        step=step_number,
        step_label=step_map[step],
        wizard=wizard,
        rag_context=rag_context,
        output_hint=output_hints[step],
    )
    raw = _parse_json(llm.invoke([("system", system_rules_es()), ("user", prompt)]).content)

    if step == 0:
        kind = _clean_text(raw.get("kind"), default="sandbox")
        tone = _as_opt_str(raw.get("tone")) or "heroico"
        return {"kind": kind, "tone": tone}
    if step == 1:
        return {"themes": _campaign_clean_list(raw.get("themes"), default="aventura")}
    if step == 2:
        level_raw = raw.get("starting_level")
        level = int(level_raw) if isinstance(level_raw, int) or (isinstance(level_raw, str) and level_raw.isdigit()) else 1
        level = max(1, min(level, 20))
        constraints = _normalize_campaign_constraints(raw.get("constraints"))
        return {"starting_level": level, "constraints": constraints}

    return {"inspirations": _campaign_clean_list(raw.get("inspirations"), default="fantasía clásica")}


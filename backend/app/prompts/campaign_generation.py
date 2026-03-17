from __future__ import annotations

WORLD_JSON_SCHEMA_HINT = {
    "name": "Nombre del mundo (corto).",
    "pitch": "Elevator pitch (2-3 frases).",
    "tone": "Tono (p. ej. oscuro, heroico, pulp).",
    "themes": {
        "themes": ["lista de temas"],
        "safety": {"lines": ["..."], "veils": ["..."]},
    },
    "draft": {
        "overview": "Resumen general del mundo.",
        "regions": [{"name": "Región", "summary": "..." }],
        "factions": [{"name": "Facción", "goal": "...", "methods": "..."}],
        "major_npcs": [{"name": "PNJ", "role": "...", "hook": "..."}],
        "secrets": ["Secretos (para el DM)"],
        "adventure_hooks": ["Ganchos de aventura"],
    },
}

WORLD_FROM_DESCRIPTION_JSON_SCHEMA_HINT = {
    "name": "Nombre del mundo (corto).",
    "pitch": "Elevator pitch (2-3 frases).",
    "tone": "Tono (p. ej. oscuro, heroico, pulp).",
    "themes": {
        "themes": ["lista de temas"],
        "safety": {"lines": ["..."], "veils": ["..."]},
    },
    "content_draft": (
        "Texto en Markdown, editable por el usuario, con secciones claras (panorama, regiones, facciones, PNJs, "
        "secretos, ganchos, notas para el DM)."
    ),
}


OUTLINE_JSON_SCHEMA_HINT = {
    "campaign_title": "Título de la campaña.",
    "logline": "Logline (1 frase).",
    "premise": "Premisa (3-6 frases).",
    "player_pitch": "Texto breve para jugadores.",
    "constraints": {"system": "5e", "starting_level": 1},
    "stakes": ["qué está en juego"],
    "core_conflicts": ["conflictos centrales"],
    "recommended_arc_count": 3,
    "arc_seeds": [
        {"title": "Nombre del arco", "summary": "Resumen", "order_index": 1, "key_locations": ["..."], "key_npcs": ["..."]}
    ],
}


ARCS_JSON_SCHEMA_HINT = {
    "arcs": [
        {
            "title": "Título del arco",
            "summary": "Resumen del arco",
            "order_index": 1,
        }
    ]
}


SESSIONS_JSON_SCHEMA_HINT = {
    "sessions": [
        {
            "session_number": 1,
            "title": "Título",
            "summary": "Resumen",
            "content_draft": {
                "opening_scene": "...",
                "objectives": ["..."],
                "scenes": [{"name": "...", "beat": "..."}],
                "encounters": [{"type": "social|combat|exploration", "details": "..."}],
                "npcs": [{"name": "...", "role": "..."}],
                "locations": [{"name": "...", "purpose": "..."}],
                "clues": ["..."],
                "loot": ["..."],
                "complications": ["..."],
                "dm_notes": ["..."],
            },
        }
    ]
}


def system_rules_es() -> str:
    return (
        "Eres un asistente experto en creación de campañas de D&D. "
        "Responde SIEMPRE en español. "
        "Devuelve únicamente JSON válido sin markdown ni texto adicional."
    )


def world_prompt_es(*, brief: dict) -> str:
    return (
        "Genera un borrador de mundo coherente para una campaña.\n"
        "Input (brief):\n"
        f"{brief}\n\n"
        "Salida requerida: JSON con esta estructura aproximada:\n"
        f"{WORLD_JSON_SCHEMA_HINT}\n"
    )


def world_from_description_prompt_es(*, description: str) -> str:
    return (
        "Genera un mundo para una campaña de rol a partir de la descripción del usuario.\n"
        "Objetivo: crear un texto editable y útil para usar como referencia en campañas.\n\n"
        "Input (descripción del usuario):\n"
        f"{description}\n\n"
        "Salida requerida: JSON con esta estructura aproximada:\n"
        f"{WORLD_FROM_DESCRIPTION_JSON_SCHEMA_HINT}\n"
    )


def outline_prompt_es(*, brief: dict, world: dict) -> str:
    return (
        "Genera el guión general (outline) de una campaña.\n"
        "Input (brief):\n"
        f"{brief}\n\n"
        "Input (world):\n"
        f"{world}\n\n"
        "Salida requerida: JSON con esta estructura aproximada:\n"
        f"{OUTLINE_JSON_SCHEMA_HINT}\n"
    )


def arcs_prompt_es(*, outline: dict, arc_count: int) -> str:
    return (
        "A partir del outline, genera arcos narrativos. Deben ser claros y ordenados.\n"
        f"Quiero exactamente {arc_count} arcos.\n"
        "Input (outline):\n"
        f"{outline}\n\n"
        "Salida requerida: JSON con esta estructura aproximada:\n"
        f"{ARCS_JSON_SCHEMA_HINT}\n"
    )


def sessions_prompt_es(*, arc: dict, outline: dict, session_count: int, starting_session_number: int) -> str:
    return (
        "A partir del arco y el outline, genera sesiones MUY detalladas para un DM.\n"
        f"Quiero exactamente {session_count} sesiones empezando por session_number={starting_session_number}.\n"
        "Input (arc):\n"
        f"{arc}\n\n"
        "Input (outline):\n"
        f"{outline}\n\n"
        "Salida requerida: JSON con esta estructura aproximada:\n"
        f"{SESSIONS_JSON_SCHEMA_HINT}\n"
    )


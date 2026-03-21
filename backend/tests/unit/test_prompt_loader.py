from __future__ import annotations

from backend.app.prompts.loader import render_prompt_template


def test_render_prompt_template_replaces_placeholders() -> None:
    rendered = render_prompt_template(
        "campaign_story_draft.txt",
        {
            "__WORLD_NAME__": "MundoX",
            "__WORLD_CONTENT__": "Contenido relevante",
            "__BRIEF_JSON__": "{}",
            "__RAG_CONTEXT_JSON__": "{}",
        },
    )

    assert "MundoX" in rendered
    assert "__WORLD_NAME__" not in rendered
    assert "__WORLD_CONTENT__" not in rendered


def test_image_prompt_templates_render_without_placeholders() -> None:
    """Plantillas DALL·E / imágenes: mismos placeholders que el resto (__KEY__)."""
    cases: list[tuple[str, dict[str, str]]] = [
        (
            "image_world_map.txt",
            {
                "__WORLD_NAME__": "Aethelgard",
                "__TONE__": "grim",
                "__PITCH__": "p",
                "__FLAVOR__": "f",
            },
        ),
        (
            "image_city_map.txt",
            {"__CITY_NAME__": "Port", "__THEME__": "t", "__WORLD_FLAVOR__": "w"},
        ),
        (
            "image_region_map.txt",
            {"__REGION_NAME__": "North", "__SUMMARY__": "s", "__WORLD_FLAVOR__": "w"},
        ),
        (
            "image_faction_emblem.txt",
            {"__FACTION_NAME__": "Red", "__OBJECTIVE__": "o", "__WORLD_FLAVOR__": "w"},
        ),
        (
            "image_character_portrait.txt",
            {
                "__CHAR_NAME__": "Lyra",
                "__FACTION__": "guild",
                "__ROLE__": "rogue",
                "__MOTIVATION__": "gold",
                "__VISUAL_DESCRIPTION__": "woman, tall",
                "__WORLD_FLAVOR__": "w",
            },
        ),
        (
            "image_npc_portrait.txt",
            {
                "__NAME__": "Bob",
                "__ROLE__": "innkeeper",
                "__HOOK__": "h",
                "__VISUAL_DESCRIPTION__": "older man",
                "__WORLD_FLAVOR__": "w",
            },
        ),
    ]
    for name, repl in cases:
        out = render_prompt_template(name, repl)
        for key in repl:
            assert key not in out, f"{name} dejó sin sustituir {key}"


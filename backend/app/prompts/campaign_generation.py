from __future__ import annotations

import json

from backend.app.prompts.loader import render_prompt_template


def system_rules_es() -> str:
    return render_prompt_template("core_system_rules.txt", {})


def world_prompt_es(*, brief: dict) -> str:
    return render_prompt_template(
        "world_from_brief.txt",
        {
            "__BRIEF_JSON__": json.dumps(brief, ensure_ascii=False, indent=2),
        },
    )


def world_from_description_prompt_es(*, description: str) -> str:
    return render_prompt_template(
        "world_from_description.txt",
        {
            "__DESCRIPTION__": description,
        },
    )


def world_from_wizard_prompt_es(
    *,
    theme_and_mood: str,
    factions: list[dict],
    characters: list[dict],
    cities: list[dict],
) -> str:
    return render_prompt_template(
        "world_wizard_final.txt",
        {
            "__THEME_AND_MOOD__": theme_and_mood,
            "__FACTIONS_JSON__": json.dumps(factions, ensure_ascii=False, indent=2),
            "__CHARACTERS_JSON__": json.dumps(characters, ensure_ascii=False, indent=2),
            "__CITIES_JSON__": json.dumps(cities, ensure_ascii=False, indent=2),
        },
    )


def outline_prompt_es(*, brief: dict, world: dict) -> str:
    return render_prompt_template(
        "campaign_outline.txt",
        {
            "__BRIEF_JSON__": json.dumps(brief, ensure_ascii=False, indent=2),
            "__WORLD_JSON__": json.dumps(world, ensure_ascii=False, indent=2),
        },
    )

def sessions_prompt_es(*, outline: dict, session_count: int, starting_session_number: int) -> str:
    return render_prompt_template(
        "campaign_sessions.txt",
        {
            "__SESSION_COUNT__": str(session_count),
            "__STARTING_SESSION_NUMBER__": str(starting_session_number),
            "__OUTLINE_JSON__": json.dumps(outline, ensure_ascii=False, indent=2),
        },
    )


def campaign_wizard_step_prompt_es(
    *,
    step: int,
    step_label: str,
    wizard: dict,
    rag_context: dict,
    output_hint: dict,
) -> str:
    return render_prompt_template(
        f"campaign_wizard_{step}.txt",
        {
            "__STEP__": str(step),
            "__STEP_LABEL__": step_label,
            "__WIZARD_JSON__": json.dumps(wizard, ensure_ascii=False, indent=2),
            "__RAG_CONTEXT_JSON__": json.dumps(rag_context, ensure_ascii=False, indent=2),
            "__OUTPUT_HINT_JSON__": json.dumps(output_hint, ensure_ascii=False, indent=2),
        },
    )


def campaign_story_markdown_system_rules_es() -> str:
    return render_prompt_template("core_markdown_system_rules.txt", {})


def campaign_story_draft_prompt_es(
    *,
    world_name: str,
    world_content: str,
    brief: dict,
    rag_context: dict,
) -> str:
    return render_prompt_template(
        "campaign_story_draft.txt",
        {
            "__WORLD_NAME__": world_name,
            "__WORLD_CONTENT__": world_content,
            "__BRIEF_JSON__": json.dumps(brief, ensure_ascii=False, indent=2),
            "__RAG_CONTEXT_JSON__": json.dumps(rag_context, ensure_ascii=False, indent=2),
        },
    )


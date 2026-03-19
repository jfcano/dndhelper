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


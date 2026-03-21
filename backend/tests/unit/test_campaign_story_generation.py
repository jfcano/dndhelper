from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from uuid import UUID

import pytest

from backend.app.services import generation_service


def test_generate_campaign_story_draft_returns_markdown(monkeypatch: pytest.MonkeyPatch) -> None:
    # Evitar OpenAI, contexto HTTP y RAG reales.
    monkeypatch.setattr(
        generation_service,
        "get_owner_id",
        lambda: UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
    )
    monkeypatch.setattr(generation_service, "answer_question", lambda *args, **kwargs: {"answer": "CTX", "sources": []})

    class _LLM:
        def __init__(self) -> None:
            self.last_messages: Any = None

        def invoke(self, messages: Any) -> Any:
            self.last_messages = messages
            return SimpleNamespace(content="## Historia fake\n- Punto 1")

    llm = _LLM()
    monkeypatch.setattr(generation_service, "_get_llm", lambda: llm)

    story = generation_service.generate_campaign_story_draft(
        brief={"kind": "sandbox", "tone": "heroico", "themes": ["aventura"], "starting_level": 1, "inspirations": []},
        world={"name": "MundoX", "content_final": "Contenido del mundo", "content_draft": None},
    )

    assert "## Historia fake" in story
    assert isinstance(story, str)

    # Aseguramos que se invocó con system + user (estructura esperada).
    assert llm.last_messages is not None
    assert isinstance(llm.last_messages, list)
    assert len(llm.last_messages) == 2


from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True)
def _openai_key_for_http_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Las rutas que requieren IA validan clave antes del handler; sin esto los tests fallarían."""
    if not os.getenv("OPENAI_API_KEY"):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-test-placeholder-integration")

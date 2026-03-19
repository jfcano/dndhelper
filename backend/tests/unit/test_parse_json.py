from __future__ import annotations

import pytest

from backend.app.services import generation_service


def test_parse_json_valid_simple() -> None:
    assert generation_service._parse_json('{"a": 1, "b": "x"}') == {"a": 1, "b": "x"}


def test_parse_json_recovers_from_noise() -> None:
    out = generation_service._parse_json('noise... {"a": 2} ...noise')
    assert out == {"a": 2}


def test_parse_json_raises_on_invalid() -> None:
    with pytest.raises(ValueError):
        generation_service._parse_json("no json here")


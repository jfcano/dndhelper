from backend.app.ingest import _sanitize_utf8


def test_sanitize_removes_nul():
    assert _sanitize_utf8("a\x00b") == "ab"


def test_sanitize_replaces_surrogates():
    # Simula texto con surrogate (no válido en UTF-8); debe no explotar y reemplazarlo.
    s = "hola" + "\udbc0" + "mundo"
    out = _sanitize_utf8(s)
    assert "\x00" not in out
    assert "hola" in out and "mundo" in out


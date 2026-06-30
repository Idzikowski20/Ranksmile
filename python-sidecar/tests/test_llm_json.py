# python-sidecar/tests/test_llm_json.py
from pipeline.llm_json import parse_json_array


def test_parses_plain_array():
    assert parse_json_array('[{"title": "A"}]') == [{"title": "A"}]


def test_strips_code_fences_and_prose():
    raw = 'Here you go:\n```json\n[{"title": "A"}]\n```\nThanks!'
    assert parse_json_array(raw) == [{"title": "A"}]


def test_recovers_trailing_comma():
    # The exact shape that used to crash the topics stage.
    assert parse_json_array('[{"title": "A"}, {"title": "B"},]') == [{"title": "A"}, {"title": "B"}]


def test_returns_none_when_no_array():
    assert parse_json_array("sorry, I cannot help with that") is None
    assert parse_json_array("") is None
    assert parse_json_array(None) is None

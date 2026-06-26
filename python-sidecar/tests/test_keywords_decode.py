# python-sidecar/tests/test_keywords_decode.py
from pipeline.stages.domain.keywords import _parse_suggest_bytes


def test_parses_utf8_response():
    raw = '["zaproszenia", ["zaproszenia ślubne"]]'.encode("utf-8")
    assert _parse_suggest_bytes(raw) == ["zaproszenia", ["zaproszenia ślubne"]]


def test_parses_cp1250_polish_response():
    # Google Suggest (client=firefox) returns Polish results in a single-byte charset
    # (ó = 0xF3), which is invalid UTF-8 and used to crash the whole seed.
    raw = '["aplikacje", ["aplikacje webowe na zamówienie"]]'.encode("cp1250")
    assert 0xF3 in raw  # the byte that broke the UTF-8 decode
    assert _parse_suggest_bytes(raw) == ["aplikacje", ["aplikacje webowe na zamówienie"]]

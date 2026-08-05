"""spaCy model must load once per language (Railway RSS)."""
from __future__ import annotations

import sys
import types

from analyzers import ner


def test_get_nlp_caches_per_model(monkeypatch):
    ner._nlp_cache.clear()
    loads: list[str] = []

    class FakeNlp:
        def __call__(self, _text: str) -> object:
            return types.SimpleNamespace(ents=[])

    def fake_load(name: str) -> FakeNlp:
        loads.append(name)
        return FakeNlp()

    monkeypatch.setitem(sys.modules, "spacy", types.SimpleNamespace(load=fake_load))

    a = ner._get_nlp("pl")
    b = ner._get_nlp("pl-PL")
    c = ner._get_nlp("en")
    assert a is b
    assert a is not c
    assert loads == ["pl_core_news_sm", "en_core_web_sm"]

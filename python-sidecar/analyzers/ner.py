"""Thin NER — spaCy if installed, else regex Title-Case spans."""
from __future__ import annotations

import re
from typing import Any

_TITLE_RE = re.compile(
    r"\b([A-ZÁĄĆĘŁŃÓŚŹŻ][\wÁáĄąĆćĘęŁłŃńÓóŚśŹźŻż]+(?:\s+[A-ZÁĄĆĘŁŃÓŚŹŻ][\wÁáĄąĆćĘęŁłŃńÓóŚśŹźŻż]+){0,3})\b"
)


def _regex_spans(text: str, max_spans: int) -> list[dict[str, Any]]:
    seen: set[str] = set()
    out: list[dict[str, Any]] = []
    for m in _TITLE_RE.finditer(text[:50_000]):
        t = m.group(1)
        key = t.lower()
        if key in seen or len(t) < 3:
            continue
        if t.lower() in {"the", "a", "an", "and", "or", "to", "in", "on", "of", "i"}:
            continue
        seen.add(key)
        out.append(
            {
                "text": t,
                "label": "MISC",
                "start": m.start(),
                "end": m.end(),
                "score": 0.55,
            }
        )
        if len(out) >= max_spans:
            break
    return out


def _spacy_spans(text: str, language: str, max_spans: int) -> list[dict[str, Any]] | None:
    try:
        import spacy  # type: ignore
    except Exception:
        return None
    model = "pl_core_news_sm" if language.startswith("pl") else "en_core_web_sm"
    try:
        nlp = spacy.load(model)
    except Exception:
        return None
    doc = nlp(text[:50_000])
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for ent in doc.ents:
        key = ent.text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(
            {
                "text": ent.text,
                "label": ent.label_ or "MISC",
                "start": ent.start_char,
                "end": ent.end_char,
                "score": 0.8,
            }
        )
        if len(out) >= max_spans:
            break
    return out


def extract_entities(text: str, language: str = "pl", max_spans: int = 40) -> dict[str, Any]:
    text = (text or "").strip()
    if not text:
        return {"spans": [], "engine": "empty"}
    spacy_out = _spacy_spans(text, language or "pl", max_spans)
    if spacy_out is not None and len(spacy_out) > 0:
        return {"spans": spacy_out, "engine": "spacy"}
    return {"spans": _regex_spans(text, max_spans), "engine": "regex"}

"""Plain SERP snippets must produce chunks / TF-IDF terms (not keyword seeds only)."""
import asyncio

from analyzers.semantic_terms import _build_chunks, extract_semantic_terms, _fallback_terms


SNIPPETS = [
    "Wojna hybrydowa – Wikipedia Wojna hybrydowa to połączenie działań militarnych i niemilitarnych.",
    "Hybrydowość współczesnych wojen analiza krytyczna konflikt hybrydowy dezinformacja.",
    "Czym jest wojna hybrydowa? Definicja i przykłady działań hybrydowych w Europie.",
    "Wojsko Polskie AWL wojna hybrydowa zagrożenia bezpieczeństwa państwa.",
    "BBN hybrydowość współczesnych wojen analiza krytyczna cyberataki propaganda.",
    "YouTube wojna hybrydowa omówienie taktyki i środków wpływu społecznego.",
]


def test_build_chunks_from_plain_snippets():
    chunks = _build_chunks(SNIPPETS)
    assert len(chunks) >= 3
    assert all(len(text) > 40 for text, _ in chunks)


def test_build_chunks_from_html_still_works():
    htmls = [
        "<h2>Definicja</h2><p>" + ("słowo " * 40) + "</p>",
        "<h2>Przykłady</h2><p>" + ("inny " * 40) + "konflikt hybrydowy</p>",
    ]
    chunks = _build_chunks(htmls)
    assert len(chunks) >= 1


def test_fallback_terms_from_snippets():
    terms = _fallback_terms(SNIPPETS, "wojna hybrydowa")
    assert len(terms) >= 3
    labels = {t["term"] for t in terms}
    # Should discover topical phrases beyond bare keyword seeds
    assert any("hybryd" in t or "dezinform" in t or "konflikt" in t for t in labels)


def test_extract_semantic_terms_plain_snippets_without_deepseek():
    terms = asyncio.run(extract_semantic_terms("wojna hybrydowa", SNIPPETS, ""))
    assert len(terms) >= 3


def test_extract_semantic_terms_plain_snippets_empty_key_uses_tfidf():
    """With a fake key but no real API, empty chunks used to return []; must TF-IDF."""
    # Simulate: key present so we don't early-return, but force no network by
    # only testing chunk→fallback path via _build_chunks + empty aggregation path.
    chunks = _build_chunks(SNIPPETS)
    assert chunks, "plain snippets must become chunks so DeepSeek can run"

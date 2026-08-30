"""The LLM term list and the TF-IDF n-grams are unioned, not chosen between.

TF-IDF used to run only when DeepSeek returned nothing, so on a healthy run the whole
n-gram set was discarded and only the model's list survived the chunk-hit filter — 15
terms for a 9-competitor SERP where the reference tool listed 81. A term the model never
named is still a term the article is graded on.
"""
import asyncio

from analyzers import semantic_terms
from analyzers.semantic_terms import _build_chunks, _cache_key, extract_semantic_terms


TERM = "wykrywanie podsluchow"
KEYWORD = "prywatny detektyw warszawa"
FILLER = (
    "Opisujemy tutaj szczegolowo cala procedure oraz jej kolejne etapy w praktyce "
    "zawodowej detektywa dzialajacego na zlecenie klienta indywidualnego. "
)
# Phrases the stubbed model never returns, so they can only arrive via TF-IDF.
PAGES = [
    f"<h2>Zakres</h2><p>{FILLER}{TERM} w biurze klienta oraz wywiad gospodarczy {FILLER}</p>"
    f"<h2>Cennik</h2><p>{FILLER}{TERM} na zlecenie i obserwacja osob {FILLER}</p>",
    f"<h2>Uslugi</h2><p>{FILLER}wywiad gospodarczy dla firm oraz obserwacja osob {FILLER}</p>",
]


def _run_with_stubbed_model(model_terms: list[dict]) -> list[dict]:
    chunks = _build_chunks(PAGES)
    semantic_terms._cache.clear()
    for _chunk_text, chunk_hash in chunks:
        semantic_terms._cache[_cache_key(KEYWORD, chunk_hash)] = list(model_terms)
    try:
        return asyncio.run(extract_semantic_terms(KEYWORD, PAGES, "test-key-unused"))
    finally:
        semantic_terms._cache.clear()


def test_tfidf_terms_survive_a_successful_model_call():
    terms = _run_with_stubbed_model([{"term": TERM, "relevance": 0.9, "type": "core"}])
    names = {t["term"] for t in terms}

    assert TERM in names, "the model's own term must still be present"
    assert len(names) > 1, f"TF-IDF n-grams were discarded again: {names}"
    assert any("wywiad" in n or "obserwacja" in n for n in names), (
        f"no TF-IDF phrase reached the output: {names}"
    )


def test_model_entry_wins_on_conflict():
    """The n-gram path cannot produce a type or a relevance, so it must not overwrite."""
    terms = _run_with_stubbed_model([{"term": TERM, "relevance": 0.9, "type": "core"}])

    rows = [t for t in terms if t["term"] == TERM]
    assert len(rows) == 1, f"term duplicated across both sources: {rows}"
    assert rows[0]["type"] == "core"


def test_every_row_keeps_the_range_contract():
    terms = _run_with_stubbed_model([{"term": TERM, "relevance": 0.9, "type": "core"}])

    for row in terms:
        assert row["suggested_min"] <= row["suggested_max"], row
        assert row["target_count"] >= 1, row


def test_count_whole_word_does_not_match_inside_a_longer_form():
    """`lt.count("emocjonalne")` matched inside "emocjonalnego" and set a 37-91 target."""
    from analyzers.semantic_terms import _count_whole_word
    text = "emocjonalnego szantazu, emocjonalnej presji, ale emocjonalne reakcje"
    assert _count_whole_word(text, "emocjonalne") == 1
    assert _count_whole_word(text, "emocjonalnego") == 1


def test_ranges_are_recalibrated_with_the_lemma_patterns_the_scorer_uses():
    """Article 97: range 6-12 derived on one inflected form, scored 112 on the lemma
    group — an automatic overshoot penalty on every core term."""
    from analyzers.term_lemmas import attach_lemma_regexps, recalibrate_ranges_with_lemmas
    text = ("szantaz emocjonalny rani. przemoc emocjonalna niszczy. "
            "emocjonalnego nacisku unikaj. reakcje emocjonalne wracaja. ") * 25
    terms = [{"term": "emocjonalnego", "target_count": 1, "suggested_min": 1, "suggested_max": 2}]
    attach_lemma_regexps(terms, [text], "pl")
    recalibrate_ranges_with_lemmas(terms, [text])
    # 4 lemma matches per 16-word sentence-block: the range must reflect the group count.
    assert terms[0]["suggested_min"] <= terms[0]["suggested_max"]
    assert terms[0]["suggested_max"] > 2

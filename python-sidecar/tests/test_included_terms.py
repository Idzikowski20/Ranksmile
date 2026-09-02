from analyzers.semantic_terms import _mark_included, _term_quality


def test_top_quality_terms_flagged_included():
    terms = [
        {"term": "poczucie winy", "doc_freq": 5, "relevance": 0.9, "type": "core"},
        {"term": "karanie ciszą", "doc_freq": 4, "relevance": 0.8, "type": "supporting"},
        {"term": "losowy zlepek", "doc_freq": 1, "relevance": 0.3, "type": "supporting"},
    ]
    _mark_included(terms, limit=2)
    by_term = {t["term"]: t["included"] for t in terms}
    assert by_term["poczucie winy"] is True
    assert by_term["karanie ciszą"] is True
    assert by_term["losowy zlepek"] is False


def test_doc_freq_dominates_quality():
    high_freq = {"term": "a", "doc_freq": 9, "relevance": 0.4}
    high_rel = {"term": "b", "doc_freq": 1, "relevance": 1.0}
    assert _term_quality(high_freq) > _term_quality(high_rel)


def test_included_selection_is_deterministic_on_ties():
    """Equal-quality terms must select by name, not extraction order, so the capped set is
    stable run-to-run."""
    base = {"doc_freq": 3, "relevance": 0.7, "type": "supporting"}
    a = [dict(base, term="alpha"), dict(base, term="beta"), dict(base, term="gamma")]
    b = list(reversed([dict(base, term="alpha"), dict(base, term="beta"), dict(base, term="gamma")]))
    _mark_included(a, limit=2)
    _mark_included(b, limit=2)
    incl_a = {t["term"] for t in a if t["included"]}
    incl_b = {t["term"] for t in b if t["included"]}
    assert incl_a == incl_b == {"alpha", "beta"}


def test_missing_fields_do_not_crash():
    terms = [{"term": "x"}, {"term": "y", "relevance": 0.7}]
    _mark_included(terms, limit=1)
    assert sum(1 for t in terms if t["included"]) == 1

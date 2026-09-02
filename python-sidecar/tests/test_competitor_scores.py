from analyzers.serp_analyzer import _attach_competitor_scores


def test_more_comprehensive_page_scores_higher():
    outlines = [
        {"url": "a", "word_count": 3000, "heading_count": 20},
        {"url": "b", "word_count": 1500, "heading_count": 10},
        {"url": "c", "word_count": 400, "heading_count": 3},
    ]
    _attach_competitor_scores(outlines)
    by = {o["url"]: o["score"] for o in outlines}
    # At/above the cohort median caps at 100; the thin page scores clearly lower.
    assert by["a"] >= by["b"] > by["c"]
    assert all(0 <= o["score"] <= 100 for o in outlines)


def test_empty_and_missing_counts_do_not_crash():
    outlines = [{"url": "x"}, {"url": "y", "word_count": 1000, "heading_count": 5}]
    _attach_competitor_scores(outlines)
    assert all("score" in o for o in outlines)

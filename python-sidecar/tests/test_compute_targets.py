from analyzers.serp_analyzer import _compute_targets


def test_snippet_fallbacks_do_not_drag_the_word_target_down():
    """
    Blocked pages fall back to title+snippet (~30 words). Averaged in as if they were
    articles, "szantaż" got words_target 675 against the reference tool's 2353-2706.
    """
    texts = [
        " ".join(["slowo"] * 2400),
        " ".join(["slowo"] * 2600),
        " ".join(["slowo"] * 30),   # snippet fallback
        " ".join(["slowo"] * 25),   # snippet fallback
    ]

    targets = _compute_targets(texts)

    assert targets["words_target"] == 2500
    assert targets["words_min"] == 2400


def test_snippets_still_count_when_nothing_scraped():
    """Snippet-only data keeps min honest but the target/max floors apply: a 27-word
    "target" would grade every real article as bloated."""
    texts = [" ".join(["slowo"] * 30), " ".join(["slowo"] * 25)]

    targets = _compute_targets(texts)

    assert targets["words_min"] == 25
    assert targets["words_target"] == 800
    assert targets["words_max"] == 1200


def test_dictionary_stub_serp_cannot_cap_a_real_article():
    """"szantaż": dictionary pages averaging ~430 words produced words_max 800, so a
    1064-word service article was penalised for beating the dictionaries."""
    texts = [" ".join(["slowo"] * n) for n in (420, 380, 500, 430)]

    targets = _compute_targets(texts)

    assert targets["words_target"] == 800
    assert targets["words_max"] == 1200

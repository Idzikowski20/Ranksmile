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


def _page(words: int, headings: int, paragraphs: int, images: int):
    """
    A scraped competitor whose extracted text is exactly `words` long.

    Every heading and paragraph contributes one word, so the first paragraph carries the
    remainder — otherwise the tags inflate the body and the ratio under test is measured
    against the wrong denominator.
    """
    from bs4 import BeautifulSoup
    # serp_analyzer counts only paragraphs of >= 3 words, so every filler carries three.
    # The first paragraph owes back the three words its filler would have contributed.
    pad = words - headings - (paragraphs - 1) * 3 - 3 + 3
    assert pad >= 1, "page too small for its own structure"
    html = (
        "".join(f"<h2>naglowek</h2>" for _ in range(headings))
        + "".join(
            f"<p>{' '.join(['slowo'] * pad)}</p>" if i == 0 else "<p>slowo slowo slowo</p>"
            for i in range(paragraphs)
        )
        + "".join('<img src="x.png">' for _ in range(images))
    )
    soup = BeautifulSoup(html, "html.parser")
    return soup.get_text(" ", strip=True), soup


def test_structure_targets_are_per_word_ratios_scaled_to_the_word_target():
    """
    Surfer's guideline for "szantaż emocjonalny" (content editor 16633552) is
    `guidelines_baseline: word_count`: every structural factor is a per-word ratio with a
    min/avg/max across the cohort, multiplied by the 2600-word target — headings
    0.004735/0.008838/0.021044 → 12.3/23/54.7. Averaging raw counts instead let a
    3000-word page with 60 headings and a 1000-word page with 5 vote as equals, so the
    target described neither the SERP's density nor the article we were about to write.
    """
    a_text, a_soup = _page(words=1000, headings=5, paragraphs=20, images=2)
    b_text, b_soup = _page(words=3000, headings=60, paragraphs=30, images=12)

    targets = _compute_targets([a_text, b_text], [a_soup, b_soup])

    assert targets["words_target"] == 2000
    # headings: ratios 0.005 and 0.020 → avg 0.0125, min 0.005, max 0.020, × 2000
    assert targets["headings_target"] == 25
    assert targets["headings_min"] == 10
    assert targets["headings_max"] == 40
    # paragraphs: ratios 0.020 and 0.010 → 30 / 20 / 40
    assert targets["paragraphs_target"] == 30
    assert targets["paragraphs_min"] == 20
    assert targets["paragraphs_max"] == 40
    # images: ratios 0.002 and 0.004 → 6 / 4 / 8
    assert targets["images_target"] == 6
    assert targets["images_min"] == 4
    assert targets["images_max"] == 8


def test_snippet_fallbacks_do_not_vote_on_structure_ratios():
    """A blocked page's snippet has no structure; its ratio must not enter the band."""
    a_text, a_soup = _page(words=2000, headings=20, paragraphs=40, images=4)
    b_text, b_soup = _page(words=2000, headings=20, paragraphs=40, images=4)
    snippet_text, snippet_soup = _page(words=30, headings=1, paragraphs=1, images=0)

    targets = _compute_targets([a_text, b_text, snippet_text], [a_soup, b_soup, snippet_soup])

    assert targets["words_target"] == 2000
    assert targets["headings_target"] == 20
    assert targets["headings_min"] == 20

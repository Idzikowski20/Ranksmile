from pipeline.internal_links import inject_suggestions

HTML = (
    "<h2>Szantaż emocjonalny w pracy</h2>"
    "<p>Przemoc psychiczna w miejscu pracy bywa trudna do udowodnienia. "
    "Warto znać swoje prawa.</p>"
    "<p>Sextortion to inna forma nacisku.</p>"
)


def test_injects_anchor_outside_headings_and_once_per_url():
    suggestions = [
        {"anchorText": "przemoc psychiczna", "url": "https://x.pl/przemoc-psychiczna/"},
        {"anchorText": "sextortion", "url": "https://x.pl/sextortion/"},
        {"anchorText": "szantaż emocjonalny", "url": "https://x.pl/szantaz/"},  # only in H2 → skipped
    ]
    out, n = inject_suggestions(HTML, suggestions)
    assert n == 2
    assert '<a href="https://x.pl/przemoc-psychiczna/">Przemoc psychiczna</a>' in out
    assert '<a href="https://x.pl/sextortion/">Sextortion</a>' in out
    assert "<h2>Szantaż emocjonalny w pracy</h2>" in out  # heading untouched


def test_never_double_links_an_url():
    html = '<p>Zobacz <a href="https://x.pl/a/">poradnik</a>. Poradnik jest długi.</p>'
    out, n = inject_suggestions(html, [{"anchorText": "Poradnik", "url": "https://x.pl/a/"}])
    assert n == 0
    assert out.count('href="https://x.pl/a/"') == 1


def test_falls_back_to_the_longest_present_word_run():
    """The model promises a verbatim anchor and routinely paraphrases: a real run
    injected 0 of 2 suggestions because no exact anchor existed in the body."""
    html = "<p>Warto znać mechanizmy manipulacji emocjonalnej w bliskiej relacji.</p>"
    out, n = inject_suggestions(html, [{
        "anchorText": "czym są mechanizmy manipulacji emocjonalnej",
        "url": "https://x.pl/manipulacja/",
    }])
    assert n == 1
    assert '<a href="https://x.pl/manipulacja/">mechanizmy manipulacji emocjonalnej</a>' in out

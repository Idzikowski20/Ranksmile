# python-sidecar/tests/test_page_signals.py
from pipeline.stages.domain.page_signals import extract_page_signals

HTML = """
<html><head>
<title>Jak wybrac hosting WordPress - kompletny poradnik</title>
<meta name="description" content="Praktyczny przewodnik po wyborze hostingu pod WordPress, krok po kroku i bez zbednych terminow.">
</head><body>
<article>
<h1>Jak wybrac hosting WordPress</h1>
<h2>Wymagania</h2><p>Pierwszy akapit ma sporo tresci.</p>
<h2>Parametry</h2><p>Drugi akapit.</p><p>Trzeci akapit.</p>
<img src="a.jpg" alt="zrzut panelu"><img src="b.jpg">
<a href="/blog/inny-wpis">link</a><a href="https://x.pl/kontakt">kontakt</a>
</article>
</body></html>
"""


def test_extracts_core_signals():
    s = extract_page_signals(HTML, "https://x.pl/blog/jak-wybrac-hosting")
    assert s["title"].startswith("Jak wybrac hosting")
    assert s["path"] == "/blog/jak-wybrac-hosting"
    assert s["heading_count"] >= 3       # h1 + 2×h2
    assert s["paragraph_count"] == 3
    assert s["word_count"] > 5
    assert 0.0 <= s["image_alt_ratio"] <= 1.0
    assert s["image_alt_ratio"] == 0.5   # 1 of 2 imgs has alt
    assert s["internal_links"] >= 1
    assert isinstance(s["content_hash"], str) and len(s["content_hash"]) == 64  # sha256 hex


def test_empty_html_is_safe():
    s = extract_page_signals("", "https://x.pl/blog/x")
    assert s["word_count"] == 0
    assert s["title"] == ""

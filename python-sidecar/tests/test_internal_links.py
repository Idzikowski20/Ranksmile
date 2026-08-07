"""In-text internal linking: allowlist prompt block + post-render enforcement."""
from pipeline.internal_links import (
    allowed_link_urls,
    enforce_internal_links,
    format_internal_link_block,
)

ARTICLES = [
    {"id": 1, "title": "Licencja detektywistyczna", "url": "https://example.pl/licencja"},
    {"id": 2, "title": "Kurs detektywa", "url": "https://example.pl/kurs/"},
]


def test_prompt_block_lists_allowed_urls():
    block = format_internal_link_block(ARTICLES, "pl")
    assert "https://example.pl/licencja" in block
    assert "Licencja detektywistyczna" in block


def test_prompt_block_empty_without_articles():
    assert format_internal_link_block([], "pl") == ""


def test_prompt_block_respects_limit():
    block = format_internal_link_block(ARTICLES, "pl", limit=1)
    assert "Kurs detektywa" not in block


def test_keeps_allowed_internal_link_ignoring_trailing_slash():
    html = '<p>Zobacz <a href="https://example.pl/kurs">kurs</a>.</p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 0
    assert out == html


def test_keeps_relative_link_that_is_on_the_allowlist():
    html = '<p><a href="/licencja">licencja</a></p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 0
    assert "<a" in out


def test_unwraps_hallucinated_internal_link_but_keeps_text():
    html = '<p>Zobacz <a href="/blog/nie-istnieje">poradnik</a>.</p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 1
    assert "<a" not in out
    assert "poradnik" in out


def test_keeps_external_and_anchor_links():
    html = (
        '<p><a href="https://gov.pl/ustawa">ustawa</a> '
        '<a href="#faq">faq</a> <a href="mailto:a@b.pl">mail</a></p>'
    )
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 0
    assert out == html


def test_www_host_counts_as_the_same_site():
    html = '<p><a href="https://www.example.pl/zmyslony">x</a></p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 1
    assert "<a" not in out


def test_strips_event_handler_from_kept_anchor():
    html = '<p><a href="https://example.pl/kurs" onclick="alert(1)">kurs</a></p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 0  # kept — on the allowlist
    assert "onclick" not in out
    assert "<a" in out


def test_strips_event_handler_from_unwrapped_anchor():
    html = '<p><a href="/blog/nie-istnieje" onmouseover="alert(1)">poradnik</a></p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 1
    assert "onmouseover" not in out


def test_path_case_is_not_folded():
    articles = [{"id": 1, "title": "Guide", "url": "https://example.pl/Guide"}]
    html = '<p><a href="/guide">x</a></p>'  # lowercase — not the allowlisted /Guide
    out, removed = enforce_internal_links(html, allowed_link_urls(articles), "https://example.pl")
    assert removed == 1
    assert "<a" not in out


def test_relative_href_without_leading_slash_resolves_against_site_root():
    # Naive f"https://{host}{path}" concatenation drops the separator here and produces
    # "https://example.plkurs/zapisy" — a mangled host, not a missing-allowlist miss.
    articles = [{"id": 1, "title": "Zapisy", "url": "https://example.pl/kurs/zapisy"}]
    html = '<p><a href="kurs/zapisy">zapisz się</a></p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(articles), "https://example.pl")
    assert removed == 0
    assert "<a" in out


def test_malformed_href_is_unwrapped_not_raised():
    html = '<p><a href="https://[::1">broken</a></p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 1
    assert "<a" not in out
    assert "broken" in out


def test_uppercase_mailto_scheme_is_kept():
    html = '<p><a href="MAILTO:a@b.pl">mail</a></p>'
    out, removed = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert removed == 0
    assert out == html


def test_strips_script_tag():
    html = '<p>text</p><script>alert(1)</script>'
    out, _ = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert "<script" not in out
    assert "alert" not in out


def test_strips_svg_onload():
    html = '<p>text</p><svg onload="alert(1)"></svg>'
    out, _ = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert "<svg" not in out
    assert "onload" not in out


def test_strips_iframe():
    html = '<p>text</p><iframe src="https://evil.example"></iframe>'
    out, _ = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert "<iframe" not in out


def test_strips_javascript_href_but_keeps_anchor_text():
    html = '<p><a href="javascript:alert(1)">click</a></p>'
    out, _ = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert "javascript:" not in out
    assert "click" in out


def test_strips_javascript_src_on_img():
    html = '<p><img src="javascript:alert(1)" onerror="alert(2)"></p>'
    out, _ = enforce_internal_links(html, allowed_link_urls(ARTICLES), "https://example.pl")
    assert "javascript:" not in out
    assert "onerror" not in out

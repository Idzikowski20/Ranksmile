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

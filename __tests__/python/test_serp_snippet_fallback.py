"""Tests for SERP scrape fallbacks used when competitor pages fail to fetch."""
import os
import sys

SIDECAR_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "python-sidecar"))
if SIDECAR_ROOT not in sys.path:
    sys.path.insert(0, SIDECAR_ROOT)

from analyzers.serp_analyzer import _is_html_url, _serp_snippet_texts  # noqa: E402


def test_skips_pdf_urls():
    assert _is_html_url("https://example.com/article") is True
    assert _is_html_url("https://example.com/file.PDF") is False
    assert _is_html_url("https://example.com/a.pdf?x=1") is False


def test_snippet_texts_from_serp_rows():
    texts = _serp_snippet_texts([
        {"title": "Wojna hybrydowa", "snippet": "Cyberataki i sabotaż poniżej progu wojny."},
        {"title": "x", "snippet": ""},
    ])
    assert len(texts) == 1
    assert "Cyberataki" in texts[0]

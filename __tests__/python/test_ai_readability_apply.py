"""Tests for AI Readability rewrite safety guards."""
import asyncio
import os
import sys

SIDECAR_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "python-sidecar"))
if SIDECAR_ROOT not in sys.path:
    sys.path.insert(0, SIDECAR_ROOT)

from analyzers import ai_readability  # noqa: E402


def test_apply_readability_refuses_html_beyond_prompt_limit(monkeypatch):
    async def fail_chat(prompt: str, max_tokens: int = 4000) -> str:
        raise AssertionError("LLM must not be called for oversized HTML")

    monkeypatch.setattr(ai_readability, "_chat", fail_chat)

    html = "<p>" + ("x" * ai_readability.MAX_APPLY_READABILITY_HTML_CHARS) + "</p>"
    result = asyncio.run(ai_readability.apply_ai_readability(
        html,
        ["Split long sections into clearer headings."],
        "keyword",
    ))

    assert result["content"] == html
    assert result["warning"] == "Article is too long to rewrite in one pass — content left unchanged."

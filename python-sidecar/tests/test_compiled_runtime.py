import asyncio

import pytest

from pipeline.compiled_runtime import run_compiled_write_plan


PLAN = {
    "title": "SEO guide",
    "keyword": "SEO",
    "graph": {"sources": [], "entities": [], "claims": [], "facts": [], "questions": []},
    "manifest": {"compiler_version": "1"},
    "knowledge_packs": [{"id": "s1", "heading": "Start", "paragraph_plan_ids": ["p1"]}],
    "paragraph_plans": [{
        "id": "p1", "section_id": "s1", "goal": "intro", "expected_words": 4,
        "claims": [], "facts": [], "entities": [], "questions": [],
        "keywords": [{"term": "SEO", "required": True}],
    }],
}


async def _write(_: str) -> str:
    return "SEO gives clear priorities."


async def _rewrite(markdown: str) -> str:
    return markdown


def test_runtime_writes_reviews_and_renders_compiled_plan():
    result = asyncio.run(run_compiled_write_plan(PLAN, _write, _rewrite))

    assert result.html == "<h1>SEO guide</h1><h2>Start</h2><p>SEO gives clear priorities.</p>"
    assert len(result.paragraphs) == 1
    assert result.paragraphs[0].base.paragraph_id == "p1"


def test_runtime_fails_closed_for_invalid_compiled_plan():
    with pytest.raises(ValueError, match="knowledge_packs"):
        asyncio.run(run_compiled_write_plan({"title": "SEO guide"}, _write, _rewrite))

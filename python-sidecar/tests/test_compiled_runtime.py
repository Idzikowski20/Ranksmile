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


def test_runtime_hands_each_paragraph_its_section_and_graph_text():
    """
    End-to-end guard for the "generator lost the outline" bug: the compiled plan carries
    the heading, the section brief (where an approved outline's instructions land) and
    the knowledge graph, but the runtime used to forward none of it to the writer.
    """
    plan = {
        **PLAN,
        "graph": {
            "sources": [], "facts": [], "entities": [],
            "claims": [{"id": "c1", "text": "Audyt trwa 2-4 tygodnie"}],
            "questions": [{"id": "q1", "text": "Ile kosztuje audyt?"}],
        },
        "knowledge_packs": [{
            "id": "s1", "heading": "Ile trwa audyt", "objective": "Podaj konkretne ramy czasowe",
            "paragraph_plan_ids": ["p1"],
        }],
        "paragraph_plans": [{
            **PLAN["paragraph_plans"][0],
            "claims": [{"claim_id": "c1"}],
            "questions": [{"question_id": "q1"}],
        }],
    }
    seen: list[str] = []

    async def _capture(prompt: str) -> str:
        seen.append(prompt)
        return "SEO gives clear priorities."

    asyncio.run(run_compiled_write_plan(plan, _capture, _rewrite))

    assert len(seen) == 1
    assert "SEO guide" in seen[0]
    assert "Ile trwa audyt" in seen[0]
    assert "Podaj konkretne ramy czasowe" in seen[0]
    assert "Audyt trwa 2-4 tygodnie" in seen[0]
    assert "Ile kosztuje audyt?" in seen[0]


def test_runtime_fails_closed_for_invalid_compiled_plan():
    with pytest.raises(ValueError, match="knowledge_packs"):
        asyncio.run(run_compiled_write_plan({"title": "SEO guide"}, _write, _rewrite))

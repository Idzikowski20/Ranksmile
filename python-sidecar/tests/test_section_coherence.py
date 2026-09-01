"""Paragraphs in one section must build on each other, not race each other.

Regression guard: every paragraph used to be written concurrently, so four paragraphs
answering one section brief produced "Pierwsze kroki:" three times over and two
near-identical tables in the same section.
"""
import asyncio

from pipeline.compiled_runtime import run_compiled_write_plan


def _plan(paragraph_ids, sections=1):
    packs, plans = [], []
    for s in range(sections):
        ids = [f"{pid}_{s}" for pid in paragraph_ids]
        packs.append({"id": f"s{s}", "heading": f"Sekcja {s}", "paragraph_plan_ids": ids})
        for pid in ids:
            plans.append({
                "id": pid, "section_id": f"s{s}", "goal": "steps", "expected_words": 5,
                "claims": [], "facts": [], "entities": [], "questions": [],
                "keywords": [{"term": "SEO", "required": True}],
            })
    return {
        "title": "Przewodnik",
        "keyword": "SEO",
        "graph": {"sources": [], "entities": [], "claims": [], "facts": [], "questions": []},
        "manifest": {"compiler_version": "1"},
        "knowledge_packs": packs,
        "paragraph_plans": plans,
    }


async def _rewrite(markdown: str) -> str:
    return markdown


def test_a_paragraph_sees_what_its_siblings_already_wrote():
    prompts: list[str] = []

    async def write(prompt: str) -> str:
        prompts.append(prompt)
        return f"Akapit numer {len(prompts)} o krokach."

    asyncio.run(run_compiled_write_plan(_plan(["p1", "p2", "p3"]), write, _rewrite))

    assert len(prompts) == 3
    # The first has nothing before it; the later ones carry the earlier prose.
    assert "Already written in this section" not in prompts[0]
    assert "Already written in this section" in prompts[1]
    assert "Akapit numer 1" in prompts[1]
    assert "Akapit numer 1" in prompts[2] and "Akapit numer 2" in prompts[2]


def test_sections_do_not_leak_into_each_other():
    """Only the current section's prose is carried — a section starts clean."""
    prompts: list[str] = []

    async def write(prompt: str) -> str:
        prompts.append(prompt)
        return f"Treść {len(prompts)}."

    asyncio.run(run_compiled_write_plan(_plan(["p1", "p2"], sections=2), write, _rewrite))

    assert len(prompts) == 4
    first_of_each = [p for p in prompts if "Already written in this section" not in p]
    assert len(first_of_each) == 2

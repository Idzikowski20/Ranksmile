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


async def _write(_: str, _words: int = 0) -> str:
    return "SEO gives clear priorities."


async def _rewrite(markdown: str) -> str:
    return markdown


def test_runtime_writes_reviews_and_renders_compiled_plan():
    result = asyncio.run(run_compiled_write_plan(PLAN, _write, _rewrite))

    assert result.html == "<h1>SEO guide</h1><h2>Start</h2><p>SEO gives clear priorities.</p>"
    assert len(result.sections) == 1
    assert result.sections[0].base.section_id == "s1"


def test_runtime_hands_each_section_its_brief_and_graph_text():
    """
    End-to-end guard for the "generator lost the outline" bug: the compiled plan carries
    the heading, the section brief (where an approved outline's instructions land) and
    the knowledge graph, and all of it has to reach the writer.
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

    async def _capture(prompt: str, _words: int) -> str:
        seen.append(prompt)
        return "SEO gives clear priorities."

    asyncio.run(run_compiled_write_plan(plan, _capture, _rewrite))

    assert len(seen) == 1
    assert "SEO guide" in seen[0]
    assert "Ile trwa audyt" in seen[0]
    assert "Podaj konkretne ramy czasowe" in seen[0]
    assert "Audyt trwa 2-4 tygodnie" in seen[0]
    assert "Ile kosztuje audyt?" in seen[0]


def test_one_call_per_section_folds_every_paragraph_plan_into_it():
    """
    The compiler still splits a section into paragraph plans (terms are allocated per
    paragraph, claims ride on the first). The writer is called once per section and has
    to see the union — a term allocated to paragraph 3 must not vanish.
    """
    plan = {
        **PLAN,
        "graph": {
            "sources": [], "facts": [], "entities": [], "questions": [],
            "claims": [{"id": "c1", "text": "Audyt trwa 2-4 tygodnie"}],
        },
        "knowledge_packs": [{
            "id": "s1", "heading": "Start", "expected_words": 90,
            "paragraph_plan_ids": ["p1", "p2", "p3"],
        }],
        "paragraph_plans": [
            {**PLAN["paragraph_plans"][0], "expected_words": 30, "claims": [{"claim_id": "c1"}]},
            {**PLAN["paragraph_plans"][0], "id": "p2", "expected_words": 30, "keywords": [{"term": "audyt"}]},
            {**PLAN["paragraph_plans"][0], "id": "p3", "expected_words": 30, "keywords": [{"term": "SEO"}]},
        ],
    }
    seen: list[tuple[str, int]] = []

    async def _capture(prompt: str, words: int) -> str:
        seen.append((prompt, words))
        return "Audyt SEO trwa 2-4 tygodnie."

    asyncio.run(run_compiled_write_plan(plan, _capture, _rewrite))

    assert len(seen) == 1
    prompt, words = seen[0]
    assert words == 90
    assert "Target words: 90" in prompt
    assert "Audyt trwa 2-4 tygodnie" in prompt
    assert "natural inflected form: SEO, audyt" in prompt


def test_runtime_formats_sources_with_and_without_titles():
    plan = {
        **PLAN,
        "graph": {
            "facts": [], "entities": [], "claims": [], "questions": [],
            "sources": [
                {"id": "src1", "url": "https://isap.sejm.gov.pl/kk.pdf", "title": "art. 191 kk"},
                {"id": "src2", "url": "https://uodo.gov.pl/decyzja"},
                {"id": "src3", "url": "https://cert.pl/raport", "title": "   "},
                {"id": "src4", "title": "brak adresu"},
                "not a mapping",
            ],
        },
        "paragraph_plans": [{
            **PLAN["paragraph_plans"][0],
            "sources": [
                {"source_id": "src1"}, {"source_id": "src2"},
                {"source_id": "src3"}, {"source_id": "src4"},
            ],
        }],
    }
    seen: list[str] = []

    async def _capture(prompt: str, _words: int) -> str:
        seen.append(prompt)
        return "SEO gives clear priorities."

    asyncio.run(run_compiled_write_plan(plan, _capture, _rewrite))

    prompt = seen[0]
    assert "art. 191 kk -> https://isap.sejm.gov.pl/kk.pdf" in prompt
    assert "https://uodo.gov.pl/decyzja -> https://uodo.gov.pl/decyzja" in prompt
    assert "https://cert.pl/raport -> https://cert.pl/raport" in prompt
    assert "brak adresu" not in prompt


def test_runtime_fails_closed_for_invalid_compiled_plan():
    with pytest.raises(ValueError, match="knowledge_packs"):
        asyncio.run(run_compiled_write_plan({"title": "SEO guide"}, _write, _rewrite))


def test_runtime_refuses_an_article_whose_every_write_came_back_empty():
    """
    Eleven consecutive empty completions rendered as a page of headings (which come from
    the plan, not the model) plus stock images, and the pipeline reported it as done.
    """
    async def _empty(_: str, _words: int) -> str:
        return ""

    with pytest.raises(RuntimeError, match="no prose"):
        asyncio.run(run_compiled_write_plan(PLAN, _empty, _rewrite))


def _sections(n: int) -> dict:
    return {
        **PLAN,
        "knowledge_packs": [
            {"id": f"s{i}", "heading": f"Sekcja {i}", "paragraph_plan_ids": [f"p{i}"]}
            for i in range(n)
        ],
        "paragraph_plans": [
            {**PLAN["paragraph_plans"][0], "id": f"p{i}", "section_id": f"s{i}"}
            for i in range(n)
        ],
    }


def test_runtime_keeps_going_when_only_some_sections_are_empty():
    """One flaky call must not throw away the sections that did come back."""
    seen: list[int] = []

    async def _flaky(_: str, _words: int) -> str:
        seen.append(1)
        return "" if len(seen) == 1 else "Audyt wskazuje priorytety."

    result = asyncio.run(run_compiled_write_plan(_sections(2), _flaky, _rewrite))

    assert "Audyt wskazuje priorytety." in result.html


def test_only_the_first_section_is_the_lead_and_only_the_last_closes():
    prompts: list[str] = []

    async def spy(prompt: str, _words: int) -> str:
        prompts.append(prompt)
        return "SEO gives clear priorities."

    asyncio.run(run_compiled_write_plan(_sections(3), spy, _rewrite))

    by_heading = {next(l for l in p.splitlines() if l.startswith("Section heading: ")): p for p in prompts}
    lead = by_heading["Section heading: Sekcja 0"]
    middle = by_heading["Section heading: Sekcja 1"]
    last = by_heading["Section heading: Sekcja 2"]
    assert "FIRST sentence answers" in lead and "FIRST sentence answers" not in middle
    assert "one concrete next step" in last and "one concrete next step" not in middle
    # Every section sees the whole outline with its own place marked.
    assert "2. Sekcja 1 (this section)" in middle


def test_sections_are_written_concurrently_but_emitted_in_reading_order():
    """
    Section 0 is the slowest here. Nothing may be emitted before it — the editor appends
    chunks, so a section that arrived early would sit above its predecessors for good —
    and once it lands, every section already finished streams out in one go.
    """
    emitted: list[tuple[int, str]] = []
    started: list[int] = []

    async def slow_first(prompt: str, _words: int) -> str:
        heading = next(l for l in prompt.splitlines() if l.startswith("Section heading: "))
        i = int(heading.rsplit(" ", 1)[1])
        started.append(i)
        await asyncio.sleep(0.05 if i == 0 else 0.001)
        return f"Treść sekcji {i}."

    async def sink(index: int, html: str) -> None:
        emitted.append((index, html))

    result = asyncio.run(run_compiled_write_plan(_sections(3), slow_first, _rewrite, on_section=sink))

    assert started == [0, 1, 2]
    assert [i for i, _ in emitted] == [-1, 0, 1, 2]
    assert emitted[0][1] == "<h1>SEO guide</h1>"
    assert emitted[1][1] == "<h2>Sekcja 0</h2><p>Treść sekcji 0.</p>"
    # The streamed chunks, concatenated, are the article the runtime returns.
    assert "".join(html for _, html in emitted) == result.html


def test_no_sink_means_no_streaming_and_the_same_article():
    result = asyncio.run(run_compiled_write_plan(_sections(2), _write, _rewrite))
    assert result.html.count("<h2>") == 2

import asyncio

from pipeline.editorial_judge import review_section
from pipeline.section_writer import Coverage, SectionResult


BASE = SectionResult(
    section_id="s1",
    markdown="First markdown.",
    summary="First markdown",
    confidence=0.4,
    used_claim_ids=("c1",),
    used_fact_ids=(),
    used_entity_ids=(),
    used_terms=(("SEO", 1),),
    coverage=Coverage(questions_answered=(), questions_missed=("q1",)),
)


async def _rewrite(markdown: str) -> str:
    assert markdown == "First markdown."
    return "Rewritten markdown."


def test_judge_rewrites_low_confidence_without_mutating_writer_result():
    reviewed = asyncio.run(review_section(BASE, _rewrite))

    assert reviewed.base is BASE
    assert reviewed.rewritten is True
    assert reviewed.markdown == "Rewritten markdown."
    assert reviewed.judge_notes == ("low_confidence",)
    assert BASE.markdown == "First markdown."


def test_judge_rewrites_critical_gap_even_when_confident():
    reviewed = asyncio.run(review_section(
        SectionResult(**{**BASE.__dict__, "confidence": 0.9}),
        _rewrite,
        critical_gaps=("missing_fact",),
    ))

    assert reviewed.rewritten is True
    assert "critical_gap:missing_fact" in reviewed.judge_notes


def test_judge_never_rewrites_an_empty_section():
    """
    Article 13 shipped "Wklej prosze akapit Markdown, ktory mam przeredagowac." as prose:
    an empty block was sent to the rewriter, whose prompt then carried no text, and the
    model's request for input became the article's text.
    """
    empty = SectionResult(**{**BASE.__dict__, "markdown": "", "confidence": 0.1})

    async def exploding_rewrite(markdown: str) -> str:
        raise AssertionError("rewrite must not be called for an empty section")

    reviewed = asyncio.run(review_section(empty, exploding_rewrite))

    assert reviewed.markdown == ""
    assert reviewed.rewritten is False
    assert "empty_not_rewritten" in reviewed.judge_notes


def test_judge_keeps_the_original_when_the_rewrite_comes_back_blank():
    async def blank_rewrite(markdown: str) -> str:
        return "   "

    reviewed = asyncio.run(review_section(BASE, blank_rewrite))

    assert reviewed.markdown == "First markdown."
    assert reviewed.rewritten is False
    assert "rewrite_empty_kept_original" in reviewed.judge_notes

import asyncio

from pipeline.editorial_judge import review_paragraph
from pipeline.section_writer import Coverage, ParagraphResult


BASE = ParagraphResult(
    paragraph_id="p1",
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
    reviewed = asyncio.run(review_paragraph(BASE, _rewrite))

    assert reviewed.base is BASE
    assert reviewed.rewritten is True
    assert reviewed.markdown == "Rewritten markdown."
    assert reviewed.judge_notes == ("low_confidence",)
    assert BASE.markdown == "First markdown."


def test_judge_rewrites_critical_gap_even_when_confident():
    reviewed = asyncio.run(review_paragraph(
        ParagraphResult(**{**BASE.__dict__, "confidence": 0.9}),
        _rewrite,
        critical_gaps=("missing_fact",),
    ))

    assert reviewed.rewritten is True
    assert "critical_gap:missing_fact" in reviewed.judge_notes

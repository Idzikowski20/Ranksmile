"""Editorial review for immutable paragraph results."""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

from pipeline.section_writer import ParagraphResult


MarkdownRewriter = Callable[[str], Awaitable[str]]


@dataclass(frozen=True)
class ReviewedParagraphResult:
    base: ParagraphResult
    markdown: str
    summary: str
    confidence: float
    judge_notes: tuple[str, ...]
    rewritten: bool


async def review_paragraph(
    result: ParagraphResult,
    rewrite_markdown: MarkdownRewriter,
    *,
    critical_gaps: Sequence[str] = (),
    confidence_threshold: float = 0.6,
) -> ReviewedParagraphResult:
    notes = tuple(f"critical_gap:{gap}" for gap in critical_gaps)
    if result.confidence < confidence_threshold:
        notes += ("low_confidence",)

    if not notes:
        return ReviewedParagraphResult(
            base=result,
            markdown=result.markdown,
            summary=result.summary,
            confidence=result.confidence,
            judge_notes=(),
            rewritten=False,
        )

    markdown = (await rewrite_markdown(result.markdown)).strip()
    return ReviewedParagraphResult(
        base=result,
        markdown=markdown,
        summary=markdown.split(".", 1)[0].strip(),
        confidence=max(result.confidence, confidence_threshold),
        judge_notes=notes,
        rewritten=True,
    )

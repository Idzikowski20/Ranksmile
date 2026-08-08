"""Editorial review for immutable paragraph results."""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

from pipeline.section_writer import ParagraphResult


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
    rewrite_markdown: Callable[[str], Awaitable[str]],
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

    # An empty paragraph has nothing to rewrite — and asking anyway is how chat replies
    # became article prose: the rewriter got a prompt with no paragraph attached and
    # answered "Wklej proszę akapit Markdown, który mam przeredagować", which shipped
    # verbatim as the article's text. The runtime's empty-article guard owns this case.
    if not result.markdown.strip():
        return ReviewedParagraphResult(
            base=result,
            markdown=result.markdown,
            summary=result.summary,
            confidence=result.confidence,
            judge_notes=notes + ("empty_not_rewritten",),
            rewritten=False,
        )

    markdown = (await rewrite_markdown(result.markdown)).strip()
    # A rewrite may only replace prose with prose. Empty output keeps the original.
    if not markdown:
        markdown = result.markdown
    return ReviewedParagraphResult(
        base=result,
        markdown=markdown,
        summary=markdown.split(".", 1)[0].strip(),
        confidence=max(result.confidence, confidence_threshold),
        judge_notes=notes,
        rewritten=True,
    )

"""Editorial review for immutable section results."""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

from pipeline.section_writer import SectionResult


@dataclass(frozen=True)
class ReviewedSectionResult:
    base: SectionResult
    markdown: str
    summary: str
    confidence: float
    judge_notes: tuple[str, ...]
    rewritten: bool


async def review_section(
    result: SectionResult,
    rewrite_markdown: Callable[[str], Awaitable[str]],
    *,
    critical_gaps: Sequence[str] = (),
    confidence_threshold: float = 0.6,
) -> ReviewedSectionResult:
    notes = tuple(f"critical_gap:{gap}" for gap in critical_gaps)
    if result.confidence < confidence_threshold:
        notes += ("low_confidence",)

    if not notes:
        return ReviewedSectionResult(
            base=result,
            markdown=result.markdown,
            summary=result.summary,
            confidence=result.confidence,
            judge_notes=(),
            rewritten=False,
        )

    # An empty section has nothing to rewrite — and asking anyway is how chat replies
    # became article prose: the rewriter got a prompt with no text attached and answered
    # "Wklej proszę akapit Markdown, który mam przeredagować", which shipped verbatim as
    # the article's text. The runtime's empty-article guard owns this case.
    if not result.markdown.strip():
        return ReviewedSectionResult(
            base=result,
            markdown=result.markdown,
            summary=result.summary,
            confidence=result.confidence,
            judge_notes=notes + ("empty_not_rewritten",),
            rewritten=False,
        )

    markdown = (await rewrite_markdown(result.markdown)).strip()
    # A rewrite may only replace prose with prose. Empty output keeps the original.
    #
    # ponytail: ceiling = the section that triggered the rewrite keeps whatever was
    # wrong with it — a critical gap or low-confidence prose survives untouched, and only
    # the judge_notes record that anything was attempted. Upgrade = retry once against a
    # different model/prompt, then flag the section for review instead of passing it.
    rewrite_failed = not markdown
    if rewrite_failed:
        markdown = result.markdown
    return ReviewedSectionResult(
        base=result,
        markdown=markdown,
        summary=markdown.split(".", 1)[0].strip(),
        confidence=max(result.confidence, confidence_threshold),
        judge_notes=notes + (("rewrite_empty_kept_original",) if rewrite_failed else ()),
        # Nothing was rewritten when the model returned nothing; saying otherwise made
        # downstream counters treat an untouched section as reviewed prose.
        rewritten=not rewrite_failed,
    )

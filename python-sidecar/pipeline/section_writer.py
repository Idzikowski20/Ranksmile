"""Paragraph writer output contract. Runtime orchestration lives in article_pipeline."""
from __future__ import annotations

import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass


MarkdownGenerator = Callable[[str], Awaitable[str]]


@dataclass(frozen=True)
class Coverage:
    questions_answered: tuple[str, ...]
    questions_missed: tuple[str, ...]


@dataclass(frozen=True)
class ParagraphResult:
    paragraph_id: str
    section_id: str
    markdown: str
    summary: str
    confidence: float
    used_claim_ids: tuple[str, ...]
    used_fact_ids: tuple[str, ...]
    used_entity_ids: tuple[str, ...]
    used_terms: tuple[tuple[str, int], ...]
    coverage: Coverage


def _reference_ids(paragraph_plan: Mapping[str, object], field: str, key: str) -> tuple[str, ...]:
    refs = paragraph_plan.get(field)
    if not isinstance(refs, list):
        return ()
    return tuple(
        value
        for ref in refs
        if isinstance(ref, Mapping)
        for value in [ref.get(key)]
        if isinstance(value, str) and value
    )


def _terms(paragraph_plan: Mapping[str, object], markdown: str) -> tuple[tuple[str, int], ...]:
    keywords = paragraph_plan.get("keywords")
    if not isinstance(keywords, list):
        return ()
    terms: list[tuple[str, int]] = []
    for keyword in keywords:
        if not isinstance(keyword, Mapping):
            continue
        term = keyword.get("term")
        if not isinstance(term, str) or not term:
            continue
        count = len(re.findall(rf"(?<!\w){re.escape(term)}(?!\w)", markdown, flags=re.IGNORECASE))
        terms.append((term, count))
    return tuple(terms)


def _confidence(markdown: str, expected_words: object, used_terms: tuple[tuple[str, int], ...]) -> float:
    target = expected_words if isinstance(expected_words, int) and expected_words > 0 else 1
    word_score = min(1.0, len(markdown.split()) / target)
    term_score = 1.0 if not used_terms else sum(count > 0 for _, count in used_terms) / len(used_terms)
    # ponytail: heuristic confidence; replace with structured Writer self-assessment when runtime requests it.
    return round((word_score + term_score) / 2, 2)


def _prompt(paragraph_plan: Mapping[str, object]) -> str:
    terms = [term for term, _ in _terms(paragraph_plan, "")]
    return (
        "Write one paragraph as Markdown only; never emit HTML.\n"
        f"Goal: {paragraph_plan.get('goal', '')}\n"
        f"Target words: {paragraph_plan.get('expected_words', '')}\n"
        f"Terms: {', '.join(terms)}"
    )


async def write_paragraph(
    paragraph_plan: Mapping[str, object],
    generate_markdown: MarkdownGenerator,
) -> ParagraphResult:
    markdown = (await generate_markdown(_prompt(paragraph_plan))).strip()
    used_terms = _terms(paragraph_plan, markdown)
    question_ids = _reference_ids(paragraph_plan, "questions", "question_id")
    return ParagraphResult(
        paragraph_id=str(paragraph_plan.get("id", "")),
        section_id=str(paragraph_plan.get("section_id", "")),
        markdown=markdown,
        summary=markdown.split(".", 1)[0].strip(),
        confidence=_confidence(markdown, paragraph_plan.get("expected_words"), used_terms),
        used_claim_ids=_reference_ids(paragraph_plan, "claims", "claim_id"),
        used_fact_ids=_reference_ids(paragraph_plan, "facts", "fact_id"),
        used_entity_ids=_reference_ids(paragraph_plan, "entities", "entity_id"),
        used_terms=used_terms,
        coverage=Coverage(questions_answered=question_ids, questions_missed=()),
    )

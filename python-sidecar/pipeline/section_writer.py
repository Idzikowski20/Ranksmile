"""Paragraph writer output contract. Runtime orchestration lives in article_pipeline."""
from __future__ import annotations

import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass


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


#: Reference field -> (id key, graph index name, prompt label). `facts` is deliberately
#: absent: the compiler mints one fact per claim with the identical statement, so
#: including both would send every claim to the writer twice.
_REFERENCE_FIELDS = (
    ("claims", "claim_id", "claims", "Must cover"),
    ("questions", "question_id", "questions", "Must answer"),
    ("entities", "entity_id", "entities", "Mention"),
)


def _resolved(
    paragraph_plan: Mapping[str, object],
    context: Mapping[str, object],
    field: str,
    key: str,
    index_name: str,
) -> list[str]:
    """Reference IDs -> the text they point at in the compiled plan's knowledge graph."""
    indexes = context.get("index")
    index = indexes.get(index_name) if isinstance(indexes, Mapping) else None
    if not isinstance(index, Mapping):
        return []
    texts = [index.get(ref_id) for ref_id in _reference_ids(paragraph_plan, field, key)]
    return [text for text in texts if isinstance(text, str) and text]


def _prompt(
    paragraph_plan: Mapping[str, object],
    context: Mapping[str, object] | None = None,
) -> str:
    """
    The paragraph's whole world, spelled out.

    The compiled plan carries the heading, the section brief (which is where an approved
    outline's instructions land) and the knowledge graph, but a ParagraphPlan points at
    the graph by ID only. Resolving those IDs here is what keeps the writer on the
    reviewed outline — prompting from `goal` + `expected_words` alone gave the model
    nothing but the keyword, so it answered with generic filler for every section.
    """
    ctx = context or {}
    terms = [term for term, _ in _terms(paragraph_plan, "")]
    lines = ["Write ONE paragraph of the article below as Markdown only; never emit HTML."]

    def add(label: str, value: object) -> None:
        text = str(value or "").strip()
        if text:
            lines.append(f"{label}: {text}")

    add("Article title", ctx.get("title"))
    add("Section heading", ctx.get("heading"))

    objective = str(ctx.get("objective") or "").strip()
    if objective:
        lines.append("Section brief (follow it — this is the approved outline):")
        lines.extend(f"- {line.strip()}" for line in objective.splitlines() if line.strip())

    add("Paragraph role", paragraph_plan.get("goal"))
    add("Target words", paragraph_plan.get("expected_words"))

    for field, key, index_name, label in _REFERENCE_FIELDS:
        resolved = _resolved(paragraph_plan, ctx, field, key, index_name)
        if resolved:
            lines.append(f"{label}: {'; '.join(resolved)}")

    add("Terms to use", ", ".join(terms))
    add("Continues from", paragraph_plan.get("transition_from"))
    add("Leads into", paragraph_plan.get("transition_to"))

    lines.append(
        "Write only this paragraph: no heading, no other sections, no preamble."
    )
    return "\n".join(lines)


async def write_paragraph(
    paragraph_plan: Mapping[str, object],
    generate_markdown: Callable[[str], Awaitable[str]],
    context: Mapping[str, object] | None = None,
) -> ParagraphResult:
    markdown = (await generate_markdown(_prompt(paragraph_plan, context))).strip()
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

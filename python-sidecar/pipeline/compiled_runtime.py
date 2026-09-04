"""Run a validated CompiledWritePlan without falling back to the legacy writer.

One LLM call per section, sections written concurrently and emitted in reading order
the moment every earlier section is done — so the editor can show section 1 while
section 7 is still being written.
"""
from __future__ import annotations

import asyncio

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass

from pipeline.editorial_judge import ReviewedSectionResult, review_section
from pipeline.html_renderer import render_html
from pipeline.md_ast import parse_markdown
from pipeline.section_writer import MarkdownGenerator, write_section


@dataclass(frozen=True)
class CompiledRunResult:
    html: str
    sections: tuple[ReviewedSectionResult, ...]


#: `(index, html)` — one finished section, headed, in reading order.
SectionSink = Callable[[int, str], Awaitable[None]]

#: Sections in flight at once. Sections share no state, so the article takes as long as
#: its slowest section plus the queueing; 4 keeps a 12-section article inside three
#: waves without hammering the provider from one container.
_CONCURRENCY = 4


def _required_list(plan: Mapping[str, object], field: str) -> list[object]:
    value = plan.get(field)
    if not isinstance(value, list):
        raise ValueError(f"compiled_write_plan.{field} must be an array")
    return value


def _text_index(graph: Mapping[str, object], field: str, key: str) -> dict[str, str]:
    """`{id: text}` for one graph collection, so section refs can be resolved by ID."""
    items = graph.get(field)
    if not isinstance(items, list):
        return {}
    index: dict[str, str] = {}
    for item in items:
        if not isinstance(item, Mapping):
            continue
        item_id, text = item.get("id"), item.get(key)
        if isinstance(item_id, str) and isinstance(text, str) and text.strip():
            index[item_id] = text.strip()
    return index


def _graph_index(plan: Mapping[str, object]) -> dict[str, dict[str, str]]:
    graph = plan.get("graph")
    if not isinstance(graph, Mapping):
        return {}
    sources: dict[str, str] = {}
    raw_sources = graph.get("sources")
    if isinstance(raw_sources, list):
        for item in raw_sources:
            if not isinstance(item, Mapping):
                continue
            item_id, url = item.get("id"), item.get("url")
            title = item.get("title")
            if isinstance(item_id, str) and isinstance(url, str) and url.strip():
                label = title.strip() if isinstance(title, str) and title.strip() else url.strip()
                sources[item_id] = f"{label} -> {url.strip()}"
    return {
        "claims": _text_index(graph, "claims", "text"),
        "questions": _text_index(graph, "questions", "text"),
        "entities": _text_index(graph, "entities", "name"),
        "sources": sources,
    }


def _section_plan(pack: Mapping[str, object], paragraphs: list[Mapping[str, object]]) -> dict[str, object]:
    """
    One plan for the whole section, folded from the compiler's paragraph plans.

    The compiler still splits a section into paragraph plans (terms are allocated per
    paragraph, claims ride on the first). The writer works per section, so the refs and
    terms are merged here — the per-paragraph goals and styles are simply not read: the
    section's shape comes from its brief now.
    """
    merged: dict[str, object] = {
        "section_id": str(pack.get("section_id") or pack.get("id") or ""),
        "expected_words": pack.get("expected_words"),
    }
    for field in ("claims", "facts", "entities", "questions", "sources", "keywords"):
        merged[field] = [
            ref for paragraph in paragraphs
            for ref in (paragraph.get(field) if isinstance(paragraph.get(field), list) else [])
        ]
    if not isinstance(merged["expected_words"], int) or merged["expected_words"] <= 0:
        merged["expected_words"] = sum(
            p.get("expected_words") for p in paragraphs
            if isinstance(p.get("expected_words"), int)
        ) or 0
    return merged


def section_html(heading: str, markdown: str) -> str:
    """The rendered section as it appears in the article: its H2 and its body."""
    return render_html(parse_markdown(f"## {heading}\n\n{markdown}"))


async def run_compiled_write_plan(
    plan: Mapping[str, object],
    generate_markdown: MarkdownGenerator,
    rewrite_markdown: Callable[[str], Awaitable[str]],
    allow_authority_links: bool = False,
    *,
    on_section: SectionSink | None = None,
    language: str = "pl",
    brand_name: str = "",
) -> CompiledRunResult:
    title = plan.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("compiled_write_plan.title must be non-empty")
    packs = _required_list(plan, "knowledge_packs")
    paragraphs = _required_list(plan, "paragraph_plans")
    registry = {
        paragraph.get("id"): paragraph
        for paragraph in paragraphs
        if isinstance(paragraph, Mapping) and isinstance(paragraph.get("id"), str)
    }
    index = _graph_index(plan)

    sections: list[tuple[str, dict[str, object], dict[str, object]]] = []
    for pack in packs:
        if not isinstance(pack, Mapping):
            raise ValueError("compiled_write_plan.knowledge_packs contains invalid pack")
        heading = pack.get("heading")
        paragraph_ids = pack.get("paragraph_plan_ids")
        if not isinstance(heading, str) or not isinstance(paragraph_ids, list):
            raise ValueError("compiled_write_plan pack is incomplete")
        section_paragraphs: list[Mapping[str, object]] = []
        for paragraph_id in paragraph_ids:
            paragraph = registry.get(paragraph_id)
            if not isinstance(paragraph, Mapping):
                raise ValueError(f"compiled_write_plan missing paragraph {paragraph_id}")
            section_paragraphs.append(paragraph)
        sections.append((heading, _section_plan(pack, section_paragraphs), {
            "title": title.strip(),
            "heading": heading,
            "objective": pack.get("objective"),
            "index": index,
            "language": language,
            "brand_name": brand_name,
            "allow_authority_links": allow_authority_links,
        }))

    outline = [heading for heading, _, _ in sections]
    for i, (_, _, context) in enumerate(sections):
        # The writer is called once per section and keeps no history between calls, so
        # where the section sits in the article has to travel with it.
        context["outline"] = outline
        context["outline_index"] = i
        context["is_lead"] = i == 0
        context["is_closing"] = i == len(sections) - 1

    if on_section:
        await on_section(-1, render_html(parse_markdown(f"# {title.strip()}")))

    semaphore = asyncio.Semaphore(_CONCURRENCY)
    results: dict[int, ReviewedSectionResult] = {}
    emitted = 0
    emit_lock = asyncio.Lock()

    async def _write_one(i: int) -> None:
        nonlocal emitted
        heading, section_plan, context = sections[i]
        async with semaphore:
            result = await write_section(section_plan, generate_markdown, context)
            results[i] = await review_section(result, rewrite_markdown)
        if not on_section:
            return
        # In reading order, never as they finish: the editor appends each chunk, so a
        # section 5 that arrived before section 2 would sit above it for good.
        async with emit_lock:
            while emitted in results:
                done_heading = sections[emitted][0]
                await on_section(emitted, section_html(done_heading, results[emitted].markdown))
                emitted += 1

    if sections:
        await asyncio.gather(*(_write_one(i) for i in range(len(sections))))

    markdown = [f"# {title.strip()}"]
    reviewed: list[ReviewedSectionResult] = []
    for i, (heading, _, _) in enumerate(sections):
        markdown.append(f"## {heading}")
        reviewed.append(results[i])
        markdown.append(results[i].markdown)

    # Headings come from the plan, so an article whose every write returned nothing still
    # renders as valid HTML and sails past a "is there any text" check. That is exactly
    # what shipped: eleven empty completions in a row became a page of headings and
    # stock images that the pipeline reported as done.
    written = sum(1 for item in reviewed if item.markdown.strip())
    if reviewed and written == 0:
        raise RuntimeError(
            f"writer produced no prose for any of {len(reviewed)} sections "
            "(headings would render but the article would be empty)"
        )
    if written < len(reviewed):
        print(f"[compiled_runtime] {len(reviewed) - written}/{len(reviewed)} sections came back empty")

    return CompiledRunResult(
        html=render_html(parse_markdown("\n\n".join(markdown))),
        sections=tuple(reviewed),
    )

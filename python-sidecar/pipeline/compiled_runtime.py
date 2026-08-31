"""Run a validated CompiledWritePlan without falling back to the legacy writer."""
from __future__ import annotations

import asyncio

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass

from pipeline.editorial_judge import ReviewedParagraphResult, review_paragraph
from pipeline.html_renderer import render_html
from pipeline.md_ast import parse_markdown
from pipeline.section_writer import write_paragraph


@dataclass(frozen=True)
class CompiledRunResult:
    html: str
    paragraphs: tuple[ReviewedParagraphResult, ...]


def _required_list(plan: Mapping[str, object], field: str) -> list[object]:
    value = plan.get(field)
    if not isinstance(value, list):
        raise ValueError(f"compiled_write_plan.{field} must be an array")
    return value


def _text_index(graph: Mapping[str, object], field: str, key: str) -> dict[str, str]:
    """`{id: text}` for one graph collection, so paragraph refs can be resolved by ID."""
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


async def run_compiled_write_plan(
    plan: Mapping[str, object],
    generate_markdown: MarkdownGenerator,
    rewrite_markdown: Callable[[str], Awaitable[str]],
    allow_authority_links: bool = False,
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

    # Plan every paragraph first, then write SECTIONS concurrently and the paragraphs
    # inside a section in order, each one seeing what its siblings already said.
    #
    # Writing every paragraph concurrently was faster, but no paragraph could know what
    # the others were writing: four paragraphs answering one section brief in parallel
    # produced "Pierwsze kroki:" three times over and two near-identical tables in the
    # same section. Sections stay parallel, so the wave count barely moves — the longest
    # section, not the article, now sets the depth.
    planned: list[tuple[str | None, Mapping[str, object] | None, Mapping[str, object] | None]] = []
    first_paragraph = True
    for pack in packs:
        if not isinstance(pack, Mapping):
            raise ValueError("compiled_write_plan.knowledge_packs contains invalid pack")
        heading = pack.get("heading")
        paragraph_ids = pack.get("paragraph_plan_ids")
        if not isinstance(heading, str) or not isinstance(paragraph_ids, list):
            raise ValueError("compiled_write_plan pack is incomplete")
        planned.append((heading, None, None))
        # The writer is called once per paragraph and keeps no history between calls, so
        # everything it needs about where the paragraph sits has to travel with it.
        for paragraph_id in paragraph_ids:
            paragraph = registry.get(paragraph_id)
            if not isinstance(paragraph, Mapping):
                raise ValueError(f"compiled_write_plan missing paragraph {paragraph_id}")
            context = {
                "title": title.strip(),
                "heading": heading,
                "objective": pack.get("objective"),
                "index": index,
                # The article's opening paragraph answers the main question outright —
                # the coverage judge awards a flat bonus for it, and readers and AI
                # engines both quote the lead, not the third section.
                "is_lead": first_paragraph,
                # Set below once the full plan is known — the closing paragraph is where
                # the reader gets the next step, and a brand block in the prompt without
                # an instruction to use it produced articles that never named the agency.
                "is_closing": False,
                # Only unlocks the prompt rule; every link it produces is still verified
                # against the authority allowlist and a live fetch before it ships.
                "allow_authority_links": allow_authority_links,
            }
            first_paragraph = False
            planned.append((None, paragraph, context))

    # 10, up from 6: ~45 paragraph writes per article ran in 8 waves; OpenRouter takes the
    # extra in-flight requests without breaking a sweat and the waves drop to 5.
    semaphore = asyncio.Semaphore(10)

    async def _write_one(paragraph: Mapping[str, object], context: Mapping[str, object]) -> ReviewedParagraphResult:
        async with semaphore:
            result = await write_paragraph(paragraph, generate_markdown, context)
            return await review_paragraph(result, rewrite_markdown)

    # Mark the last real paragraph as the closing one.
    for i in range(len(planned) - 1, -1, -1):
        _, paragraph, context = planned[i]
        if paragraph is not None and context is not None:
            context["is_closing"] = True
            break

    # Indices of the paragraphs belonging to each section, in reading order.
    section_groups: list[list[int]] = []
    for i, (heading, paragraph, _) in enumerate(planned):
        if heading is not None:
            section_groups.append([])
        elif paragraph is not None:
            if not section_groups:
                section_groups.append([])
            section_groups[-1].append(i)

    results: dict[int, ReviewedParagraphResult] = {}

    async def _write_section(indices: list[int]) -> None:
        already: list[str] = []
        for i in indices:
            _, paragraph, context = planned[i]
            if paragraph is None or context is None:
                continue
            context["already_written"] = list(already)
            results[i] = await _write_one(paragraph, context)
            text = results[i].markdown.strip()
            if text:
                already.append(text)

    groups = [g for g in section_groups if g]
    if groups:
        await asyncio.gather(*(_write_section(g) for g in groups))

    markdown = [f"# {title.strip()}"]
    reviewed: list[ReviewedParagraphResult] = []
    for i, (heading, paragraph, _) in enumerate(planned):
        if heading is not None:
            markdown.append(f"## {heading}")
            continue
        judged = results[i]
        reviewed.append(judged)
        markdown.append(judged.markdown)

    # Headings come from the plan, so an article whose every write returned nothing still
    # renders as valid HTML and sails past a "is there any text" check. That is exactly
    # what shipped: eleven empty completions in a row became a page of headings and
    # stock images that the pipeline reported as done.
    written = sum(1 for item in reviewed if item.markdown.strip())
    if reviewed and written == 0:
        raise RuntimeError(
            f"writer produced no prose for any of {len(reviewed)} paragraphs "
            "(headings would render but the article would be empty)"
        )
    if written < len(reviewed):
        print(f"[compiled_runtime] {len(reviewed) - written}/{len(reviewed)} paragraphs came back empty")

    return CompiledRunResult(
        html=render_html(parse_markdown("\n\n".join(markdown))),
        paragraphs=tuple(reviewed),
    )

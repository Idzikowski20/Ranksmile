"""Run a validated CompiledWritePlan without falling back to the legacy writer."""
from __future__ import annotations

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
    return {
        "claims": _text_index(graph, "claims", "text"),
        "questions": _text_index(graph, "questions", "text"),
        "entities": _text_index(graph, "entities", "name"),
    }


async def run_compiled_write_plan(
    plan: Mapping[str, object],
    generate_markdown: MarkdownGenerator,
    rewrite_markdown: Callable[[str], Awaitable[str]],
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

    markdown = [f"# {title.strip()}"]
    reviewed: list[ReviewedParagraphResult] = []
    for pack in packs:
        if not isinstance(pack, Mapping):
            raise ValueError("compiled_write_plan.knowledge_packs contains invalid pack")
        heading = pack.get("heading")
        paragraph_ids = pack.get("paragraph_plan_ids")
        if not isinstance(heading, str) or not isinstance(paragraph_ids, list):
            raise ValueError("compiled_write_plan pack is incomplete")
        markdown.append(f"## {heading}")
        # The writer is called once per paragraph and keeps no history between calls, so
        # everything it needs about where the paragraph sits has to travel with it.
        context = {
            "title": title.strip(),
            "heading": heading,
            "objective": pack.get("objective"),
            "index": index,
        }
        for paragraph_id in paragraph_ids:
            paragraph = registry.get(paragraph_id)
            if not isinstance(paragraph, Mapping):
                raise ValueError(f"compiled_write_plan missing paragraph {paragraph_id}")
            result = await write_paragraph(paragraph, generate_markdown, context)
            judged = await review_paragraph(result, rewrite_markdown)
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

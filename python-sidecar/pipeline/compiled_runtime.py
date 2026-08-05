"""Run a validated CompiledWritePlan without falling back to the legacy writer."""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass

from pipeline.editorial_judge import ReviewedParagraphResult, review_paragraph
from pipeline.html_renderer import render_html
from pipeline.md_ast import parse_markdown
from pipeline.section_writer import MarkdownGenerator, write_paragraph


@dataclass(frozen=True)
class CompiledRunResult:
    html: str
    paragraphs: tuple[ReviewedParagraphResult, ...]


def _required_list(plan: Mapping[str, object], field: str) -> list[object]:
    value = plan.get(field)
    if not isinstance(value, list):
        raise ValueError(f"compiled_write_plan.{field} must be an array")
    return value


async def run_compiled_write_plan(
    plan: Mapping[str, object],
    generate_markdown: MarkdownGenerator,
    rewrite_markdown: Callable[[str], Awaitable[str]],
) -> CompiledRunResult:
    title = plan.get("title")
    if not isinstance(title, str) or not title.strip():
        raise ValueError("compiled_write_plan.title must be non-empty")
    _required_list(plan, "knowledge_packs")
    paragraphs = _required_list(plan, "paragraph_plans")
    registry = {
        paragraph.get("id"): paragraph
        for paragraph in paragraphs
        if isinstance(paragraph, Mapping) and isinstance(paragraph.get("id"), str)
    }

    markdown = [f"# {title.strip()}"]
    reviewed: list[ReviewedParagraphResult] = []
    for pack in _required_list(plan, "knowledge_packs"):
        if not isinstance(pack, Mapping):
            raise ValueError("compiled_write_plan.knowledge_packs contains invalid pack")
        heading = pack.get("heading")
        paragraph_ids = pack.get("paragraph_plan_ids")
        if not isinstance(heading, str) or not isinstance(paragraph_ids, list):
            raise ValueError("compiled_write_plan pack is incomplete")
        markdown.append(f"## {heading}")
        for paragraph_id in paragraph_ids:
            paragraph = registry.get(paragraph_id)
            if not isinstance(paragraph, Mapping):
                raise ValueError(f"compiled_write_plan missing paragraph {paragraph_id}")
            result = await write_paragraph(paragraph, generate_markdown)
            judged = await review_paragraph(result, rewrite_markdown)
            reviewed.append(judged)
            markdown.append(judged.markdown)

    return CompiledRunResult(
        html=render_html(parse_markdown("\n\n".join(markdown))),
        paragraphs=tuple(reviewed),
    )

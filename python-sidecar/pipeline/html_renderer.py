"""Safe HTML renderer for the minimal Section Writer Markdown AST."""
from __future__ import annotations

import html
import re
from urllib.parse import urlparse

from pipeline.md_ast import MdAst, MdNode


def _safe_href(value: str) -> str:
    parsed = urlparse(value)
    return value if parsed.scheme in {"http", "https"} or value.startswith("/") else "#"


def _inline(text: str) -> str:
    escaped = html.escape(text, quote=False)
    escaped = re.sub(
        r"\[([^\]]+)\]\(([^)\s]+)\)",
        lambda match: f'<a href="{html.escape(_safe_href(match.group(2)), quote=True)}">{match.group(1)}</a>',
        escaped,
    )
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    return re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", escaped)


def _render(node: MdNode) -> str:
    if node.kind == "heading":
        return f"<h{node.depth}>{_inline(node.text)}</h{node.depth}>"
    if node.kind == "paragraph":
        return f"<p>{_inline(node.text)}</p>"
    if node.kind == "list":
        tag = "ol" if node.ordered else "ul"
        return f"<{tag}>" + "".join(f"<li>{_inline(item)}</li>" for item in node.items) + f"</{tag}>"
    if node.kind == "table":
        head = "".join(f"<th>{_inline(header)}</th>" for header in node.headers)
        body = "".join(
            "<tr>" + "".join(f"<td>{_inline(cell)}</td>" for cell in row) + "</tr>"
            for row in node.rows
        )
        return f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>"
    raise ValueError(f"Unsupported MdNode kind: {node.kind}")


def render_html(ast: MdAst) -> str:
    return "".join(_render(node) for node in ast.children)

"""Minimal Markdown AST used by the Section Writer render path."""
from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class MdNode:
    kind: str
    text: str = ""
    depth: int = 0
    ordered: bool = False
    items: tuple[str, ...] = ()
    headers: tuple[str, ...] = ()
    rows: tuple[tuple[str, ...], ...] = ()


@dataclass(frozen=True)
class MdAst:
    children: tuple[MdNode, ...]


_HEADING = re.compile(r"^(#{1,3})\s+(.+)$")
_UNORDERED = re.compile(r"^[-*]\s+(.+)$")
_ORDERED = re.compile(r"^\d+[.)]\s+(.+)$")


def _table_cells(line: str) -> tuple[str, ...]:
    return tuple(cell.strip() for cell in line.strip().strip("|").split("|"))


def _table_separator(line: str) -> bool:
    cells = _table_cells(line)
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", cell) for cell in cells)


def parse_markdown(markdown: str) -> MdAst:
    lines = markdown.strip().splitlines()
    nodes: list[MdNode] = []
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue

        heading = _HEADING.match(line)
        if heading:
            nodes.append(MdNode(kind="heading", depth=len(heading.group(1)), text=heading.group(2)))
            index += 1
            continue

        if "|" in line and index + 1 < len(lines) and _table_separator(lines[index + 1]):
            headers = _table_cells(line)
            index += 2
            rows: list[tuple[str, ...]] = []
            while index < len(lines) and "|" in lines[index] and lines[index].strip():
                rows.append(_table_cells(lines[index]))
                index += 1
            nodes.append(MdNode(kind="table", headers=headers, rows=tuple(rows)))
            continue

        unordered = _UNORDERED.match(line)
        ordered = _ORDERED.match(line)
        if unordered or ordered:
            matcher = _UNORDERED if unordered else _ORDERED
            items: list[str] = []
            while index < len(lines):
                item = matcher.match(lines[index].strip())
                if not item:
                    break
                items.append(item.group(1))
                index += 1
            nodes.append(MdNode(kind="list", ordered=ordered is not None, items=tuple(items)))
            continue

        paragraph = [line]
        index += 1
        while index < len(lines) and lines[index].strip():
            if _HEADING.match(lines[index].strip()) or _UNORDERED.match(lines[index].strip()) or _ORDERED.match(lines[index].strip()):
                break
            paragraph.append(lines[index].strip())
            index += 1
        nodes.append(MdNode(kind="paragraph", text=" ".join(paragraph)))

    return MdAst(children=tuple(nodes))

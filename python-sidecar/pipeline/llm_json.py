"""Tolerant JSON-array extraction for LLM responses.

LLMs (especially over non-English content) frequently return *almost*-valid JSON:
wrapped in ```json fences, padded with prose, or with a trailing comma before a
closing bracket. A bare `json.loads` then raises and the whole stage falls back to
empty. This helper recovers the common cases.
"""
import json
import re


def parse_json_array(text: str | None) -> list | None:
    """Best-effort parse of a JSON array from an LLM response.

    Handles markdown code fences, surrounding prose, and a single trailing comma
    before the closing bracket. Returns the list, or None if nothing parses.
    """
    if not text:
        return None

    # Prefer the contents of a ```json … ``` fence when present.
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    candidate = fenced.group(1) if fenced else text

    match = re.search(r"\[[\s\S]*\]", candidate)
    if not match:
        return None
    blob = match.group(0)

    # Attempt 1: as-is. Attempt 2: strip trailing commas before ] or }.
    for attempt in (blob, re.sub(r",(\s*[\]}])", r"\1", blob)):
        try:
            parsed = json.loads(attempt)
        except json.JSONDecodeError:
            continue
        return parsed if isinstance(parsed, list) else None
    return None

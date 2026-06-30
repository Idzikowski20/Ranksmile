"""KeywordsStage — expand seed keywords via Google Suggest, dedupe, return top N."""
import asyncio
import json
from urllib.parse import quote

import httpx

from pipeline.contracts import AnalysisStage, StageContext


def _parse_suggest_bytes(raw: bytes) -> list:
    """Decode a Google Suggest response body and parse its JSON.

    The `client=firefox` endpoint returns Central-European results in a single-byte
    charset (Polish 'ó' = 0xF3), not UTF-8, so a plain UTF-8 decode raises and the
    whole seed used to fail. Try UTF-8 first (correct when Google does send it), then
    Windows-1250, then Latin-1 (which never fails) as a safety net.
    """
    for enc in ("utf-8", "cp1250", "latin-1"):
        try:
            return json.loads(raw.decode(enc))
        except UnicodeDecodeError:
            continue
    return json.loads(raw.decode("utf-8", errors="replace"))


async def _fetch_suggest(client: httpx.AsyncClient, seed: str) -> list[str]:
    """Call Google Suggest with 3× retry/backoff. Returns suggestion strings."""
    url = f"https://suggestqueries.google.com/complete/search?client=firefox&q={quote(seed)}"
    for attempt in range(3):
        try:
            resp = await client.get(url, timeout=10)
            resp.raise_for_status()
            data = _parse_suggest_bytes(resp.content)
            # Response: [query, [suggestions, ...]]
            return data[1] if isinstance(data, list) and len(data) > 1 else []
        except Exception as exc:
            if attempt == 2:
                print(f"[keywords] suggest failed for {seed!r}: {exc}")
                return []
            await asyncio.sleep(0.5 * (attempt + 1))
    return []


class KeywordsStage(AnalysisStage):
    name = "keywords"
    progress_weight = 0.2

    async def run(self, ctx: StageContext) -> dict:
        seed_keywords: list[str] = ctx.payload.get("seedKeywords", [])
        limits: dict = ctx.payload.get("limits", {})
        max_keywords: int = int(limits.get("keywords", 20))

        await ctx.emit_progress(self, 10, "Fetching Google Suggest for seed keywords")

        # Collect suggestions from Suggest; tag seed keywords as 'gsc'
        seen: set[str] = set()
        result: list[dict[str, str]] = []

        for kw in seed_keywords:
            kw_clean = kw.strip().lower()
            if kw_clean and kw_clean not in seen:
                seen.add(kw_clean)
                result.append({"keyword": kw_clean, "source": "gsc"})

        await ctx.emit_progress(self, 40, f"Expanding {len(seed_keywords)} seeds via Suggest")

        async with httpx.AsyncClient(follow_redirects=True) as client:
            tasks = [_fetch_suggest(client, seed) for seed in seed_keywords[:10]]
            all_suggestions = await asyncio.gather(*tasks)

        await ctx.emit_progress(self, 70, "Deduplicating keyword list")

        for suggestions in all_suggestions:
            for suggestion in suggestions:
                kw_clean = suggestion.strip().lower()
                if kw_clean and kw_clean not in seen:
                    seen.add(kw_clean)
                    result.append({"keyword": kw_clean, "source": "suggest"})

        trimmed = result[:max_keywords]
        ctx.set_state("keywords", trimmed)

        await ctx.emit_progress(self, 100, f"Keywords ready: {len(trimmed)} keywords")
        return {"keywords": trimmed}

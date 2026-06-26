"""KeywordsStage — expand seed keywords via Google Suggest, dedupe, return top N."""
import asyncio
from urllib.parse import quote

import httpx

from pipeline.contracts import AnalysisStage, StageContext


async def _fetch_suggest(client: httpx.AsyncClient, seed: str) -> list[str]:
    """Call Google Suggest with 3× retry/backoff. Returns suggestion strings."""
    url = f"https://suggestqueries.google.com/complete/search?client=firefox&q={quote(seed)}"
    for attempt in range(3):
        try:
            resp = await client.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
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

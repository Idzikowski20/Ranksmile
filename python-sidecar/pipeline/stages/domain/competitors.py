"""CompetitorsStage — SERP-based competitor aggregation across top keywords."""
import asyncio
from urllib.parse import urlparse

from analyzers.serp_analyzer import analyze_serp
from pipeline.contracts import AnalysisStage, StageContext


def _domain_from_url(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


async def _serp_with_retry(keyword: str, language: str = "pl", max_attempts: int = 3) -> dict:
    """Call analyze_serp with up to max_attempts retries on failure."""
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return await analyze_serp(keyword, language=language)
        except Exception as exc:
            last_exc = exc
            if attempt < max_attempts - 1:
                await asyncio.sleep(0.5 * (attempt + 1))
    print(f"[competitors] SERP failed for {keyword!r} after {max_attempts} attempts: {last_exc}")
    return {}


class CompetitorsStage(AnalysisStage):
    name = "competitors"
    progress_weight = 0.4

    async def run(self, ctx: StageContext) -> dict:
        keywords: list[dict] = ctx.get_state("keywords") or []
        language: str = ctx.payload.get("language", "pl")
        limits: dict = ctx.payload.get("limits", {})
        # Cap to ~8 keywords to stay within the lean SERP budget
        max_kw = int(limits.get("competitorsPerKeyword", 10))
        top_keywords = [k["keyword"] for k in keywords[:8]]
        total = len(top_keywords)

        # domain → {appearances, position_sum}
        domain_stats: dict[str, dict] = {}

        for i, keyword in enumerate(top_keywords):
            pct = int(i / total * 100) if total else 100
            await ctx.emit_progress(self, pct, f"Analyzing SERP for keyword {i + 1}/{total}: {keyword}")

            serp_data = await _serp_with_retry(keyword, language)
            for competitor in serp_data.get("competitors", []):
                url: str = competitor.get("url", "")
                domain = competitor.get("domain", "") or _domain_from_url(url)
                if not domain:
                    continue
                if domain not in domain_stats:
                    domain_stats[domain] = {"appearances": 0, "position_sum": 0.0}
                domain_stats[domain]["appearances"] += 1
                # serp position is 1-based; use index in competitors list as proxy
                domain_stats[domain]["position_sum"] += float(
                    serp_data.get("competitors", []).index(competitor) + 1
                )

        # Build ranked list: top by appearances, keep top `max_kw` (~10)
        ranked = sorted(
            domain_stats.items(),
            key=lambda x: (-x[1]["appearances"], x[1]["position_sum"]),
        )[:max_kw]

        competitors = [
            {
                "competitor_domain": domain,
                "appearances": stats["appearances"],
                "avg_position": round(stats["position_sum"] / stats["appearances"], 2)
                if stats["appearances"] else None,
            }
            for domain, stats in ranked
        ]

        ctx.set_state("competitors", competitors)
        await ctx.emit_progress(self, 100, f"Competitors ready: {len(competitors)} domains")
        return {"competitors": competitors}

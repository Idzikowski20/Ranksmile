"""Stage 6: AI Search visibility — the info that drives LLM citations.

Runs the same analysis as the manual /ai-visibility endpoint, but inline during
deep analysis so the editor's "AI Search — Info to cover" list is populated
without a separate click.
"""
import re
from urllib.parse import urlparse
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.ai_visibility import run_ai_visibility

_HTML_TAG = re.compile(r"<[^>]+>")


class AiSearchStage(AnalysisStage):
    name = "ai_search"
    progress_weight = 0.10

    def can_skip(self, ctx: StageContext) -> bool:
        # Nothing to check without a target keyword.
        return not ctx.payload.get("keyword")

    async def run(self, ctx: StageContext) -> dict:
        keyword = ctx.payload.get("keyword", "")
        url = ctx.payload.get("url", "")
        own_domain = urlparse(url).netloc.replace("www.", "") if url else ""

        serp = ctx.get_state("scrape_serp") or {}
        fetch = ctx.get_state("fetch_page") or {}
        competitor_domains = [c.get("domain", "") for c in serp.get("competitors", []) if c.get("domain")]

        html = fetch.get("html", "") or ""
        article_content = " ".join(filter(None, [
            fetch.get("meta_title", ""),
            fetch.get("meta_description", ""),
            _HTML_TAG.sub(" ", html),
        ]))

        await ctx.emit_progress(self, 20, "Checking AI search visibility...")
        summary = await run_ai_visibility(keyword, own_domain, competitor_domains, article_content)
        await ctx.emit_progress(
            self, 90,
            f"AI search: {summary.get('prompts_cited', 0)}/{summary.get('prompts_total', 0)} cited",
        )
        return summary

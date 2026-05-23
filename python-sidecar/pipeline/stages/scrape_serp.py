"""Stage 2: SERP analysis — wraps existing serp_analyzer."""
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.serp_analyzer import analyze_serp


class ScrapeSerpStage(AnalysisStage):
    name = "scrape_serp"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        keyword = ctx.payload.get("keyword", "")
        language = ctx.payload.get("language", "pl")
        if not keyword:
            raise ValueError("keyword is required in payload")

        await ctx.emit_progress(self, 30, f"Scraping SERP for: {keyword}")
        serp_data = await analyze_serp(keyword, language, num_results=10)
        await ctx.emit_progress(self, 80, f"Found {len(serp_data.get('competitors', []))} competitors")

        return serp_data

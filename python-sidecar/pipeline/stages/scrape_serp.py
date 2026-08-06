"""Stage 2: SERP analysis — wraps existing serp_analyzer.
analyze_serp() now accepts include_texts=True to return _competitor_texts,
avoiding a second scrape of the same competitor pages."""
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
        await ctx.emit_phase({"fetchingSerp": {"status": "RUNNING"}})

        async def on_page(finished: int, total: int, url: str) -> None:
            await ctx.emit_phase(
                {
                    "fetchingSerp": {"status": "DONE"},
                    "crawlingSerp": {
                        "status": "RUNNING",
                        "finished": finished,
                        "total": total,
                        "currentUrl": url,
                    },
                },
                f"Crawling result {finished}/{total}",
            )

        serp_data = await analyze_serp(
            keyword, language, num_results=10, include_texts=True, on_page=on_page,
        )

        found = len(serp_data.get("competitors", []))
        await ctx.emit_phase({
            "fetchingSerp": {"status": "DONE"},
            "crawlingSerp": {"status": "DONE"},
            "loadingCompetitors": {"status": "RUNNING"},
        })
        await ctx.emit_progress(self, 70, f"Found {found} competitors")

        return serp_data

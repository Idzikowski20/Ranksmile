"""Stage 3: Content classification — uses analyzers.content_classifier (DeepSeek)."""
from pipeline.contracts import AnalysisStage, StageContext


class ClassifyContentStage(AnalysisStage):
    name = "classify_content"
    progress_weight = 0.15

    async def run(self, ctx: StageContext) -> dict:
        fetch = ctx.get_state("fetch_page") or {}
        html = fetch.get("html", "")

        if not html:
            raise ValueError("fetch_page html is empty — cannot classify")

        await ctx.emit_progress(self, 10, "Classifying content quality")

        from analyzers.content_classifier import classify

        result = await classify(html)

        await ctx.emit_progress(self, 100, "Content classification complete")
        return result

"""Stage 4: Semantic term extraction — mock, returns hardcoded data.
Replaced by analyzers.semantic_terms in Phase 3."""
from pipeline.contracts import AnalysisStage, StageContext


class ExtractTermsStage(AnalysisStage):
    name = "extract_terms"
    progress_weight = 0.20

    async def run(self, ctx: StageContext) -> dict:
        await ctx.emit_progress(self, 50, "Extracting terms (mock)")

        return {
            "terms": [
                {"term": "content marketing strategy", "target_count": 4, "type": "core"},
                {"term": "keyword research tools", "target_count": 3, "type": "supporting"},
                {"term": "SEO best practices", "target_count": 5, "type": "core"},
            ]
        }

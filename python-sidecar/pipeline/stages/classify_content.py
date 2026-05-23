"""Stage 3: Content classification — mock, returns hardcoded data.
Replaced by real content_classifier.py in Phase 3."""
from pipeline.contracts import AnalysisStage, StageContext


class ClassifyContentStage(AnalysisStage):
    name = "classify_content"
    progress_weight = 0.15

    async def run(self, ctx: StageContext) -> dict:
        fetch = ctx.get_state("fetch_page") or {}
        html = fetch.get("html", "")

        await ctx.emit_progress(self, 50, "Classifying content (mock)")

        return {
            "page_type": "article",
            "page_type_confidence": 0.85,
            "is_thin": False,
            "thin_reason": None,
            "word_count_estimate": len(html.split()) if html else 0,
            "has_author": False,
            "has_date": False,
            "has_sources": False,
            "eeat_score": 50,
            "content_originality_risk": "medium",
            "is_evergreen": True,
            "freshness_score": 50,
        }

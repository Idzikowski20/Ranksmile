"""Stage 4: Semantic term extraction via analyzers.semantic_terms."""
import os
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.semantic_terms import extract_semantic_terms


class ExtractTermsStage(AnalysisStage):
    name = "extract_terms"
    progress_weight = 0.20

    async def run(self, ctx: StageContext) -> dict:
        serp = ctx.get_state("scrape_serp") or {}
        keyword = ctx.payload.get("keyword", "")
        deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
        competitor_texts = serp.get("_competitor_texts", []) or []

        await ctx.emit_progress(self, 20, f"Extracting semantic terms for: {keyword}")
        terms = await extract_semantic_terms(keyword, competitor_texts, deepseek_key)
        # scrape_serp may already have terms (incl. snippet-based extraction) — keep the richer set
        existing = serp.get("terms") or []
        if len(terms) < len(existing):
            terms = existing
        await ctx.emit_progress(self, 90, f"Extracted {len(terms)} terms")

        return {"terms": terms}

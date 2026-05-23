"""Stage 5: Ranking score via analyzers.ranking_scorer with hybrid 70/30 approach."""
import os
from pipeline.contracts import AnalysisStage, StageContext
from analyzers.ranking_scorer import predict_ranking


class ScoreRankingStage(AnalysisStage):
    name = "score_ranking"
    progress_weight = 0.25

    async def run(self, ctx: StageContext) -> dict:
        keyword = ctx.payload.get("keyword", "")
        deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")

        serp = ctx.get_state("scrape_serp") or {}
        classify = ctx.get_state("classify_content") or {}
        fetch = ctx.get_state("fetch_page") or {}

        site_context = {
            "meta": {
                "title": fetch.get("meta_title", ""),
                "title_length": len(fetch.get("meta_title", "")),
                "description": fetch.get("meta_description", ""),
                "description_length": len(fetch.get("meta_description", "")),
                "og_title": fetch.get("og_title", ""),
                "og_description": fetch.get("og_description", ""),
                "og_image": fetch.get("og_image", ""),
                "canonical": fetch.get("canonical", ""),
            },
            "content": {
                "word_count": classify.get("word_count_estimate", 0),
                "paragraph_count": fetch.get("paragraph_count", 0),
            },
            "headings": {"total": fetch.get("heading_count", 0)},
            "issues": fetch.get("issues", []),
        }

        rule_base = _compute_rule_base(site_context, serp, classify)

        await ctx.emit_progress(self, 30, "Predicting ranking score via AI...")
        result = await predict_ranking(
            keyword=keyword,
            content_score=rule_base,
            site_context=site_context,
            serp_data=serp,
            content_class=classify,
            deepseek_key=deepseek_key,
        )
        await ctx.emit_progress(self, 90, f"Final score: {result['ranking_score']}/100")

        return result


def _compute_rule_base(site_context: dict, serp_data: dict, classify: dict) -> int:
    """Simple proxy for contentScore.ts rule engine. Returns 0-100."""
    score = 80
    content = site_context.get("content", {})
    word_count = content.get("word_count", 0)
    words_target = serp_data.get("words_target", 2200)
    if words_target and word_count < words_target * 0.5:
        score -= 20
    elif words_target and word_count < words_target * 0.8:
        score -= 10

    meta = site_context.get("meta", {})
    title_len = meta.get("title_length", 0)
    if title_len < 30 or title_len > 65:
        score -= 10
    desc_len = meta.get("description_length", 0)
    if desc_len < 70:
        score -= 5

    is_thin = classify.get("is_thin", False)
    if is_thin:
        score -= 25

    eeat = classify.get("eeat_score", 50)
    if eeat < 30:
        score -= 15
    elif eeat < 50:
        score -= 5

    return max(0, min(100, score))

"""RecommendationsStage — LLM-generated content recommendations over topics + competitors."""
import json
import os
import re

import anthropic

from pipeline.contracts import AnalysisStage, StageContext

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=os.getenv("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com/anthropic",
        )
    return _client


MODEL = "deepseek-v4-flash"


async def _llm_recommendations(
    topics: list[dict],
    competitors: list[dict],
    brand_knowledge: str,
) -> list[dict] | None:
    """Single LLM call; returns parsed list or None on failure."""
    topics_str = json.dumps(topics[:8], ensure_ascii=False)
    competitors_str = json.dumps(
        [{"domain": c["competitor_domain"], "appearances": c["appearances"]} for c in competitors[:10]],
        ensure_ascii=False,
    )
    brand_block = f"Brand context: {brand_knowledge[:600]}" if brand_knowledge.strip() else ""

    prompt = (
        f"Given these SEO topics {topics_str}, competitor domains {competitors_str}, "
        f"and {brand_block} produce 5-10 prioritized content recommendations. "
        "Return ONLY valid JSON (no markdown, no explanation): "
        '[{"title": "...", "rationale": "...", "priority": "high|medium|low", '
        '"type": "...", "topic_index": 0}]'
    )
    client = _get_client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    for block in response.content:
        if block.type == "text":
            raw = block.text
            json_match = re.search(r"\[[\s\S]*\]", raw)
            if json_match:
                return json.loads(json_match[0])
    return None


class RecommendationsStage(AnalysisStage):
    name = "recommendations"
    progress_weight = 0.2

    async def run(self, ctx: StageContext) -> dict:
        topics: list[dict] = ctx.get_state("topics") or []
        competitors: list[dict] = ctx.get_state("competitors") or []
        brand_knowledge: str = ctx.payload.get("brandKnowledge", "")

        await ctx.emit_progress(self, 30, "Generating content recommendations")

        recs: list[dict] | None = None
        try:
            recs = await _llm_recommendations(topics, competitors, brand_knowledge)
        except Exception as exc:
            print(f"[recommendations] LLM call failed: {exc}")

        if recs is None:
            # Retry once on parse failure or exception
            try:
                recs = await _llm_recommendations(topics, competitors, brand_knowledge)
            except Exception as exc:
                print(f"[recommendations] LLM retry failed: {exc}")
                recs = []

        if not isinstance(recs, list):
            recs = []

        ctx.set_state("recommendations", recs)
        await ctx.emit_progress(self, 100, f"Recommendations ready: {len(recs)} items")
        return {"recommendations": recs}

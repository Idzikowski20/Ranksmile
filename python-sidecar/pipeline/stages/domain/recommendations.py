"""RecommendationsStage — LLM-generated content recommendations over topics + competitors."""
import json
import os

import anthropic

from pipeline.contracts import AnalysisStage, StageContext
from pipeline.llm_json import parse_json_array

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(
            api_key=os.getenv("DEEPSEEK_API_KEY", ""),
            base_url="https://api.deepseek.com/anthropic",
        )
    return _client


# Non-reasoning model: deepseek-v4-flash's 'thinking' block consumed the whole
# max_tokens budget, leaving no 'text' output. deepseek-chat returns clean JSON.
MODEL = "deepseek-chat"


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
        "Return ONLY valid JSON (no markdown, no explanation). Keep rationales short and "
        "do NOT use double-quote characters inside any string value. "
        '[{"title": "...", "rationale": "...", "priority": "high|medium|low", '
        '"type": "...", "topic_index": 0}]'
    )
    client = _get_client()
    response = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )
    for block in response.content:
        if block.type == "text":
            return parse_json_array(block.text)
    return None


class RecommendationsStage(AnalysisStage):
    name = "recommendations"
    progress_weight = 0.2

    async def run(self, ctx: StageContext) -> dict:
        topics: list[dict] = ctx.get_state("topics") or []
        competitors: list[dict] = ctx.get_state("competitors") or []
        brand_knowledge: str = ctx.payload.get("brandKnowledge", "")
        audits: list[dict] = ctx.get_state("page_audits") or []

        from pipeline.stages.domain.triage_scorer import OPTIMIZE_THRESHOLD

        # Evidence at the stage boundary: shows whether the upstream chain
        # (keywords → topics → competitors, blog audit) actually fed this stage.
        print(f"[recommendations] inputs: topics={len(topics)} competitors={len(competitors)} "
              f"audits={len(audits)} brand_knowledge={'yes' if brand_knowledge.strip() else 'no'}")

        # 1. Optimize recs: audited posts under the threshold, worst-first (immutable snapshot).
        weak = sorted(
            [a for a in audits if a.get("fetch_status") == "OK" and a.get("score") is not None
             and a["score"] < OPTIMIZE_THRESHOLD],
            key=lambda a: a["score"],
        )
        recs: list[dict] = []
        for a in weak[:20]:
            recs.append({
                "title": a.get("title") or a.get("path") or a["url"],
                "rationale": f"Content score {a['score']}/100 — below {OPTIMIZE_THRESHOLD}. Improve depth, headings, and meta.",
                "priority": "high" if a["score"] < 50 else "medium",
                "type": "optimize",
                "url": a["url"],
                "score": a["score"],
            })

        # 2. Create recs: existing LLM content ideas from topics + competitors.
        await ctx.emit_progress(self, 60, "Generating content ideas")
        ideas = None
        try:
            ideas = await _llm_recommendations(topics, competitors, brand_knowledge)
        except Exception as exc:  # noqa: BLE001
            print(f"[recommendations] LLM call failed: {exc}")
        print(f"[recommendations] optimize={len(recs)} create(LLM ideas)={len(ideas or [])}")
        for idea in (ideas or [])[:5]:
            recs.append({
                "title": idea.get("title", ""),
                "rationale": idea.get("rationale", ""),
                "priority": idea.get("priority", "medium"),
                "type": "create",
                "topic_index": idea.get("topic_index"),
            })

        ctx.set_state("recommendations", recs)
        await ctx.emit_progress(self, 100, f"{len(recs)} recommendations")
        return {"recommendations": recs}

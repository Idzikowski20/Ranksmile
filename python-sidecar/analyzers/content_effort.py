"""
Content Effort insight — LLM estimate of how hard the article is to cheaply
replicate with one prompt (original data, experience, structure, uniqueness).

Explicitly NOT a Google NSR / contentEffort leak clone — product-facing copy
must say "our estimate".
"""
import json
import re

from pipeline.article_pipeline import _chat


def _fallback(note: str, score: int = 0) -> dict:
    return {
        "score": score,
        "reasons": [note][:3],
        "source": "llm",
    }


async def run_content_effort(article_content: str, keyword: str = "") -> dict:
    text = (article_content or "").strip()
    if not text:
        return _fallback("Add content to estimate effort.")

    prompt = f"""You estimate CONTENT EFFORT — how hard this article would be to cheaply
replicate with a single generic LLM prompt. This is NOT "detect AI writing".

Topic/keyword: "{keyword}"

Score 0–100 where:
- 0–30: thin, template, no unique data/experience, easy one-prompt clone
- 31–60: some structure but mostly generic SERP rehash
- 61–85: clear unique angles, data, experience, or hard-to-fake structure
- 86–100: strong original research / first-hand detail / custom assets implied

Judge using these signals:
1) Original data / numbers / tables / research
2) Custom multimedia or descriptive visual explanations
3) Information gain vs a typical SERP page
4) First-person / lived experience / case specifics
5) Lead answers the query early; density over fluff

Return ONLY JSON:
{{"score":72,"reasons":["reason 1","reason 2","reason 3"]}}

rules for reasons:
- exactly 3 short reasons (max 18 words each)
- in the ARTICLE's language
- focus on replicability / effort gaps or strengths
- never say "Google", "NSR", or "contentEffort leak"

ARTICLE:
{text[:12000]}"""

    try:
        raw = await _chat(prompt, max_tokens=600)
        match = re.search(r"\{[\s\S]*\}", raw)
        if not match:
            return _fallback("Effort estimate unavailable.")
        data = json.loads(match.group(0))
        score = int(data.get("score", 0))
        score = max(0, min(100, score))
        raw_reasons = data.get("reasons") or []
        reasons = [str(r).strip()[:200] for r in raw_reasons if str(r).strip()][:3]
        while len(reasons) < 3:
            reasons.append("Add more unique, hard-to-copy specifics.")
        return {"score": score, "reasons": reasons, "source": "llm"}
    except Exception as exc:  # noqa: BLE001
        print(f"[content_effort] failed: {exc}")
        return _fallback("Effort estimate unavailable.")

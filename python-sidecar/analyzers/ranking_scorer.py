"""
Multi-signal ranking prediction with hybrid 70/30 approach.
final_score = round(0.7 * rule_base + 0.3 * llm_adjustment)

rule_base = content_score proxy (simple rule engine, mirrors contentScore.ts)
llm_adjustment = DeepSeek holistic analysis of 6 signals + rubric

Result includes versioning metadata for full reproducibility.
"""
import hashlib
import json
import os
import re
from datetime import datetime, timezone

import httpx


async def predict_ranking(
    keyword: str,
    content_score: int,
    site_context: dict,
    serp_data: dict,
    content_class: dict,
    deepseek_key: str,
) -> dict:
    """Predict ranking probability with hybrid scoring.
    Returns {ranking_score, ranking_signals} with version metadata."""
    meta = site_context.get("meta", {})
    content = site_context.get("content", {})
    headings = site_context.get("headings", {})
    issues = site_context.get("issues", [])

    word_count = content.get("word_count", 0)
    heading_count = headings.get("total", 0)
    paragraph_count = content.get("paragraph_count", 0)

    words_target = serp_data.get("words_target", 2200)
    headings_target = serp_data.get("headings_target", 15)
    paragraphs_target = serp_data.get("paragraphs_target", 20)

    title = meta.get("title", "")
    title_length = meta.get("title_length", 0)
    desc = meta.get("description", "")
    desc_length = meta.get("description_length", 0)
    og_tags = {
        "og_title": bool(meta.get("og_title")),
        "og_description": bool(meta.get("og_description")),
        "og_image": bool(meta.get("og_image")),
    }
    canonical = meta.get("canonical", "")

    page_type = content_class.get("page_type", "unknown")
    is_thin = content_class.get("is_thin", False)
    eeat_score = content_class.get("eeat_score", 50)
    originality = content_class.get("content_originality_risk", "medium")
    freshness = content_class.get("freshness_score", 50)

    issues_json = json.dumps([
        {"check": i.get("check", ""), "severity": i.get("severity", "warning"), "message": i.get("message", "")}
        for i in issues[:10]
    ])

    input_data = {
        "keyword": keyword,
        "content_score": content_score,
        "word_count": word_count,
        "heading_count": heading_count,
        "paragraph_count": paragraph_count,
        "words_target": words_target,
        "headings_target": headings_target,
        "paragraphs_target": paragraphs_target,
        "title_length": title_length,
        "desc_length": desc_length,
        "og_tags": og_tags,
        "page_type": page_type,
        "is_thin": is_thin,
        "eeat_score": eeat_score,
        "originality": originality,
        "freshness": freshness,
        "issues_count": len(issues),
        "issues_error": sum(1 for i in issues if i.get("severity") == "error"),
    }
    input_hash = hashlib.sha256(json.dumps(input_data, sort_keys=True).encode()).hexdigest()[:16]

    prompt_version = "2026-05-24"
    model = "deepseek-chat"

    if not deepseek_key:
        return _fallback_score(content_score, input_hash, prompt_version, model)

    prompt = f"""You are an SEO ranking analyst. Using the provided numeric rubric, predict
how likely this page is to rank in Google top 10 for "{keyword}".
Rate each signal 0-100 with verdict. Do not reward vague quality.
Use the exact numbers provided in the input data where relevant.

Return JSON:
{{
  "total": 0-100,
  "signals": [
    {{"name": "meta_quality", "score": 0-100, "verdict": "adequate|strong|needs_work|weak", "recommendation": "..."}},
    {{"name": "content_depth", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "eeat", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "freshness", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "technical", "score": 0-100, "verdict": "...", "recommendation": "..."}},
    {{"name": "competitiveness", "score": 0-100, "verdict": "...", "recommendation": "..."}}
  ],
  "summary": "one-sentence verdict"
}}

Scoring rubric (MUST follow exactly):
- 10-30: Thin content, missing E-E-A-T, poor meta, clear AI-generated
- 31-50: Some content but below competitors, basic SEO issues
- 51-70: Adequate content, some authority, decent optimization
- 71-85: Competitive depth, good E-E-A-T, clean technical SEO
- 86-95: Comprehensive, strong authority, fully optimized, fresh content

Decisive signals (E-E-A-T missing, thin content) drag total down significantly.
Strong content depth alone does NOT compensate for missing authority.

INPUT DATA:
Keyword: {keyword}
Content score (rule-based): {content_score}/100
Competitor averages: words={words_target}, headings={headings_target}, paragraphs={paragraphs_target}
Meta: title="{title}" ({title_length} chars), desc="{desc}" ({desc_length} chars), OG={json.dumps(og_tags)}, canonical={canonical}
Content stats: {word_count} words, {heading_count} headings, {paragraph_count} paragraphs
Content class: page_type={page_type}, thin={is_thin}, eeat={eeat_score}, originality={originality}, freshness={freshness}
Issues: {issues_json}"""

    try:
        async with httpx.AsyncClient(timeout=45) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {deepseek_key}",
                },
                json={
                    "model": model,
                    "max_tokens": 1024,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw: str = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\{[\s\S]*\}", raw)
        if not json_match:
            return _fallback_score(content_score, input_hash, prompt_version, model)

        llm_result = json.loads(json_match[0])
        llm_total = int(llm_result.get("total", content_score))

        # Hybrid: 70% rule base + 30% LLM adjustment
        final_score = round(0.7 * content_score + 0.3 * llm_total)
        final_score = max(0, min(100, final_score))

        scored_at = datetime.now(timezone.utc).isoformat()

        return {
            "ranking_score": final_score,
            "ranking_signals": {
                "version": "ranking_scorer_v1",
                "model": model,
                "prompt_version": prompt_version,
                "input_hash": input_hash,
                "scored_at": scored_at,
                "rule_base": content_score,
                "llm_total": llm_total,
                "final_score": final_score,
                "signals": llm_result.get("signals", []),
                "summary": llm_result.get("summary", ""),
            },
        }

    except Exception as exc:
        print(f"[ranking_scorer] DeepSeek error: {exc}")
        return _fallback_score(content_score, input_hash, prompt_version, model)


def _fallback_score(content_score: int, input_hash: str, prompt_version: str, model: str) -> dict:
    scored_at = datetime.now(timezone.utc).isoformat()
    return {
        "ranking_score": content_score,
        "ranking_signals": {
            "version": "fallback_v0",
            "model": model,
            "prompt_version": prompt_version,
            "input_hash": input_hash,
            "scored_at": scored_at,
            "rule_base": content_score,
            "llm_total": None,
            "final_score": content_score,
            "signals": [],
            "summary": "AI scoring unavailable — using rule-based score only.",
        },
    }

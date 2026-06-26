"""
AI Readability — LLM rubric assessment of how well content is structured for
LLMs/readers (10 criteria), mirroring Surfer's "How do we assess AI Readability".
Returns a per-criterion met/note breakdown plus a 0-100 score.
"""
import json
import re

from pipeline.article_pipeline import _chat

# (key, title, description) — keys are stable and shared with the frontend modal.
CRITERIA = [
    ("introduction", "Introduction Section", "Clear, dedicated introduction that sets expectations (what's covered, who it's for, why it matters) and provides context."),
    ("early_query", "Early Query Confirmation", "Target query and core topic are clearly addressed within the first paragraph or visible screen area, giving immediate confirmation of relevance."),
    ("search_intent", "Search Intent Alignment", "Content directly addresses the implied search intent with relevant information prominently featured throughout the document."),
    ("concept_clarity", "Concept Definition and Relationship Clarity", "Key concepts are explicitly defined and relationships between ideas are clearly stated, so readers and LLMs understand how concepts connect."),
    ("progression", "General-to-Specific Progression", "Content follows a clear educational progression from broad concepts to specific details, each level building on the previous."),
    ("inter_section", "Inter-Section Connectivity", "Each section connects logically to the next with clear transitions, creating a coherent narrative flow."),
    ("self_sufficiency", "Contextual Self-Sufficiency", "Provides enough background and foundational information for the target audience without requiring external resources, while linking to related topics."),
    ("top_headings", "Top-Level Heading Structure", "All major sections have clear, consistently formatted top-level headings (h1/h2) that accurately reflect the content."),
    ("subheadings", "Subheading and Navigation Structure", "Clear, descriptive, consistently formatted subheadings; sections appropriately sized (3-5 sentences) and well-organized for scanning."),
    ("info_density", "Information Density Optimization", "Complex information condensed into essential points without redundancy, using the most effective format (steps, lists, tables)."),
]


def _empty(note: str) -> dict:
    return {
        "score": 0,
        "criteria": [{"key": k, "title": t, "met": False, "note": note} for k, t, _ in CRITERIA],
    }


async def run_ai_readability(article_content: str, keyword: str = "") -> dict:
    text = (article_content or "").strip()
    if not text:
        return _empty("Add content to assess.")

    rubric = "\n".join(f'- {k}: {t} — {d}' for k, t, d in CRITERIA)
    prompt = f"""You are an SEO/AI-readability assessor. Judge how well the ARTICLE below is
structured for both human readers and LLMs (AI Overviews, ChatGPT). Topic/keyword: "{keyword}".

Evaluate the article against EACH criterion. For each, decide "met" (true/false) honestly based on
the actual content, and add a short note (max 12 words) explaining why.

Criteria (use the exact key):
{rubric}

Return ONLY JSON, no prose:
{{"criteria":[{{"key":"introduction","met":true,"note":"short reason"}}, ...]}}

ARTICLE:
{text[:14000]}"""

    by_key: dict = {}
    try:
        raw = await _chat(prompt, max_tokens=1500)
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            data = json.loads(match.group(0))
            for c in data.get("criteria", []):
                if isinstance(c, dict) and c.get("key"):
                    by_key[c["key"]] = c
    except Exception as exc:  # noqa: BLE001
        print(f"[ai_readability] assessment failed: {exc}")
        return _empty("Assessment unavailable.")

    criteria = []
    met_count = 0
    for k, t, _ in CRITERIA:
        c = by_key.get(k, {})
        met = bool(c.get("met"))
        if met:
            met_count += 1
        criteria.append({"key": k, "title": t, "met": met, "note": str(c.get("note", ""))[:140]})

    score = round(met_count / len(CRITERIA) * 100)
    return {"score": score, "criteria": criteria}

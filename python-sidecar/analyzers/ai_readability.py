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

MAX_APPLY_READABILITY_HTML_CHARS = 24000


def _empty(note: str) -> dict:
    return {
        "score": 0,
        "criteria": [{"key": k, "title": t, "met": False, "note": note, "suggestions": []} for k, t, _ in CRITERIA],
        "coverage_items": [],
    }


def _to_coverage_items(criteria_results):
    """Reshape rubric results into CoverageItem-compatible dicts (category=quality)."""
    items = []
    for c in criteria_results:
        key = c.get("key")
        if not key:
            continue
        met = bool(c.get("met"))
        suggestions = c.get("suggestions") or []
        items.append({
            "id": f"readability-{key}",
            "label": c.get("title") or key,
            "type": "readability",
            "category": "quality",
            "importance": "recommended",
            "source": "llm",
            "covered": met,
            "quality": 5 if met else 0,
            "missing": [s for s in suggestions if isinstance(s, str)],
            "needsExpansion": (not met) and bool(suggestions),
        })
    return items


async def run_ai_readability(article_content: str, keyword: str = "") -> dict:
    text = (article_content or "").strip()
    if not text:
        return _empty("Add content to assess.")

    rubric = "\n".join(f'- {k}: {t} — {d}' for k, t, d in CRITERIA)
    prompt = f"""You are an SEO/AI-readability assessor. Judge how well the ARTICLE below is
structured for both human readers and LLMs (AI Overviews, ChatGPT). Topic/keyword: "{keyword}".

Evaluate the article against EACH criterion. For each:
- decide "met" (true/false) honestly based on the actual content,
- add a short "note" (max 14 words, in the ARTICLE's language) explaining the verdict,
- if NOT met, add 1-3 "suggestions": concrete, actionable edit instructions written in the
  ARTICLE's language, each referencing the exact section/heading to change and what to add or
  rewrite (e.g. 'Dodaj nagłówek H2 "FAQ" przed sekcją...'). When met, "suggestions" must be [].

Criteria (use the exact key):
{rubric}

Return ONLY JSON, no prose:
{{"criteria":[{{"key":"introduction","met":true,"note":"short reason","suggestions":[]}},
{{"key":"top_headings","met":false,"note":"short reason","suggestions":["actionable fix"]}}, ...]}}

ARTICLE:
{text[:14000]}"""

    by_key: dict = {}
    try:
        raw = await _chat(prompt, max_tokens=2600)
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
        raw_sugs = c.get("suggestions") or []
        suggestions = [str(s).strip() for s in raw_sugs if isinstance(s, (str, int, float)) and str(s).strip()][:3]
        if met:
            suggestions = []
        criteria.append({
            "key": k,
            "title": t,
            "met": met,
            "note": str(c.get("note", ""))[:300],
            "suggestions": suggestions,
        })

    score = round(met_count / len(CRITERIA) * 100)
    return {
        "score": score,
        "criteria": criteria,
        "coverage_items": _to_coverage_items(criteria),
    }


async def apply_ai_readability(content_html: str, suggestions: list[str], keyword: str = "") -> dict:
    """Rewrite the article HTML applying the AI-readability suggestions (structure-only),
    preserving all existing content/links/images. Returns {"content": html}."""
    html = (content_html or "").strip()
    sugs = [str(s).strip() for s in (suggestions or []) if str(s).strip()]
    if not html or not sugs:
        return {"content": content_html}
    if len(html) > MAX_APPLY_READABILITY_HTML_CHARS:
        return {"content": content_html, "warning": "Article is too long to rewrite in one pass — content left unchanged."}

    sug_list = "\n".join(f"{i + 1}. {s}" for i, s in enumerate(sugs))
    prompt = f"""You are an expert editor improving an HTML article's STRUCTURE for AI/LLM
readability (AI Overviews, ChatGPT) and human scanning. Topic/keyword: "{keyword}".

Apply EVERY suggestion below to the ARTICLE HTML. The suggestions are structural: add or fix
headings, split sections into clear subheadings, convert dense paragraphs into bullet/numbered
lists, add an explicit definition sentence, etc.

RULES:
- Preserve ALL existing information, every <a> link and every <img> exactly as-is.
- Do NOT remove content or shorten the article; only restructure / add what the suggestions ask.
- Keep the article's original language.
- Output valid HTML using only these tags: h1 h2 h3 p ul ol li strong em a img blockquote.
- Return ONLY the full updated HTML body — no markdown code fences, no commentary.

SUGGESTIONS:
{sug_list}

ARTICLE HTML:
{html[:MAX_APPLY_READABILITY_HTML_CHARS]}"""

    try:
        raw = await _chat(prompt, max_tokens=8000)
    except Exception as exc:  # noqa: BLE001
        print(f"[ai_readability] apply failed: {exc}")
        return {"content": content_html, "warning": "Optimization failed — content left unchanged."}

    out = (raw or "").strip()
    out = re.sub(r"^```(?:html)?\s*", "", out)
    out = re.sub(r"\s*```$", "", out).strip()
    # Guard against a garbage / non-HTML response — never replace good content with junk.
    if "<" not in out or len(out) < len(html) * 0.5:
        return {"content": content_html, "warning": "Article is too long to rewrite in one pass — content left unchanged."}
    return {"content": out}

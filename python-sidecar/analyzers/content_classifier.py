"""
Content classifier — Grox-like 5-dimension classification.
Pre-LLM extraction: word count, author, date, schema detection.
DeepSeek: page_type, eeat_score, content_originality_risk, is_evergreen, freshness_score.
"""
import json
import os
import re
from bs4 import BeautifulSoup
import httpx


async def classify(html: str, url: str = "") -> dict:
    """Classify a webpage across 5 content quality dimensions.
    Returns dict with page_type, eeat_score, content_originality_risk, etc."""
    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
        tag.decompose()

    text = soup.get_text(separator=" ", strip=True)
    word_count = len(text.split())

    # Author detection
    has_author = bool(
        soup.find("meta", attrs={"name": "author"})
        or soup.find(rel="author")
        or soup.select_one(".byline, .author, [class*=author]")
    )

    # Date detection
    has_date = bool(
        soup.find("time")
        or soup.find(attrs={"pubdate": True})
        or soup.find("meta", property="article:published_time")
        or _find_iso_date(text)
    )

    # Schema article detection
    has_schema_article = False
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "{}")
            types = []
            if isinstance(data, list):
                for d in data:
                    t = d.get("@type", "")
                    types.extend(t if isinstance(t, list) else [t])
            else:
                t = data.get("@type", "")
                types.extend(t if isinstance(t, list) else [t])
            if any(tp in ("Article", "NewsArticle", "BlogPosting") for tp in types):
                has_schema_article = True
                break
        except (json.JSONDecodeError, TypeError):
            pass

    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)
    h1_tag = soup.find("h1")
    h1_text = h1_tag.get_text(strip=True) if h1_tag else ""

    headings = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4"])[:15]:
        t = tag.get_text(strip=True)
        if t:
            headings.append(t)

    meta_desc = ""
    desc_tag = soup.find("meta", attrs={"name": "description"})
    if desc_tag:
        meta_desc = desc_tag.get("content", "")[:300]

    body_sample = text[:2000]

    is_thin = word_count < 300
    thin_reason = "word_count<300" if is_thin else None
    if word_count < 50:
        is_thin = True
        thin_reason = "js_shell"

    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    if not deepseek_key:
        return _fallback_classification(word_count, has_author, has_date, has_schema_article, is_thin, thin_reason)

    prompt = f"""Analyze this webpage content for SEO quality. Return JSON:
{{
  "page_type": "article|product|landing_page|blog_listing|documentation|unknown",
  "page_type_confidence": 0.0-1.0,
  "is_thin": true/false,
  "thin_reason": null|"word_count<300"|"cookie_wall"|"paywall"|"js_shell",
  "eeat_score": 0-100,
  "content_originality_risk": "low|medium|high",
  "is_evergreen": true/false,
  "freshness_score": 0-100
}}

CONTENT:
Title: {title}
H1: {h1_text}
Headings: {json.dumps(headings[:15])}
Body sample: {body_sample}
Meta description: {meta_desc}
Pre-extracted: word_count={word_count}, has_author={has_author}, has_date={has_date}, has_schema_article={has_schema_article}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {deepseek_key}",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 512,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw: str = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\{[\s\S]*\}", raw)
        if json_match:
            result = json.loads(json_match[0])
        else:
            print(f"[classifier] No JSON in response: {raw[:200]}")
            return _fallback_classification(word_count, has_author, has_date, has_schema_article, is_thin, thin_reason)

        result["word_count_estimate"] = word_count
        result["has_author"] = has_author
        result["has_date"] = has_date
        result["has_sources"] = bool(has_schema_article)
        result["is_thin"] = result.get("is_thin", is_thin)
        result["thin_reason"] = result.get("thin_reason", thin_reason)

        return result

    except Exception as e:
        print(f"[classifier] DeepSeek API error: {e}")
        return _fallback_classification(word_count, has_author, has_date, has_schema_article, is_thin, thin_reason)


def _fallback_classification(word_count: int, has_author: bool, has_date: bool, has_schema_article: bool, is_thin: bool, thin_reason: str | None) -> dict:
    """Rule-based fallback when DeepSeek is unavailable."""
    eeat = 50
    if has_author:
        eeat += 10
    if has_date:
        eeat += 10
    if has_schema_article:
        eeat += 10
    eeat = min(eeat, 100)

    freshness = 70 if has_date else 40

    return {
        "page_type": "unknown",
        "page_type_confidence": 0.3,
        "is_thin": is_thin,
        "thin_reason": thin_reason,
        "eeat_score": eeat,
        "content_originality_risk": "medium",
        "is_evergreen": False,
        "freshness_score": freshness,
        "word_count_estimate": word_count,
        "has_author": has_author,
        "has_date": has_date,
        "has_sources": has_schema_article,
    }


def _find_iso_date(text: str) -> bool:
    """Check if text contains an ISO 8601 date pattern (YYYY-MM-DD)."""
    return bool(re.search(r"\b20\d{2}-\d{2}-\d{2}\b", text))

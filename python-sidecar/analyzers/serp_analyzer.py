"""
SERP analyzer: fetches top results, scrapes competitor pages, and extracts
SEO terms from competitor content.
"""
import asyncio
import os
import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from analyzers.html_parse import parse_html
from analyzers.semantic_terms import extract_semantic_terms


# ── SPA fallback: use Next.js headless browser endpoint for JS-rendered pages ──
NEXTJS_URL = os.getenv("NEXTJS_URL", "http://127.0.0.1:3000")


async def _fetch_via_spa_fallback(url: str, plain_text: str) -> str | None:
    """If plain-text content is thin (< 200 chars), retry via headless browser."""
    if len(plain_text) >= 200:
        return None  # Content is fine, no need for fallback

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                f"{NEXTJS_URL}/api/render-page",
                json={"url": url, "timeout": 15000},
                headers={"x-internal-token": os.getenv("INTERNAL_PIPELINE_TOKEN", "")},
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("html"):
                print(f"[serp_analyzer] SPA fallback success for {url} ({len(plain_text)} → {len(data['html'])} chars)")
                return data["html"]
    except Exception as exc:
        print(f"[serp_analyzer] SPA fallback failed for {url}: {exc}")

    return None


def domain_from_url(url: str) -> str:
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return ""


async def analyze_serp(keyword: str, language: str = "pl", num_results: int = 10, include_texts: bool = False) -> dict:
    serper_key = os.getenv("SERPER_API_KEY", "")

    if not serper_key:
        print("[serp_analyzer] No SERPER_API_KEY - using keyword seed data")
        return _placeholder_score_data(keyword)

    serp_results, paa_questions = await _fetch_serp_results(keyword, language, num_results, serper_key)
    serp_urls = [r["link"] for r in serp_results]
    if not serp_urls:
        return _placeholder_score_data(keyword)

    serp_texts, soups = await _scrape_pages(serp_urls)
    if not serp_texts:
        return _placeholder_score_data(keyword)

    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    nlp_terms = await extract_semantic_terms(keyword, serp_texts, deepseek_key)
    # If extraction came back thin, seed from the keyword (language-correct) so we
    # never ship an empty/irrelevant entity list. DataForSEO enrichment (Node side)
    # layers real keyword data on top when the list is weak.
    if len(nlp_terms) < 3:
        existing = {t["term"] for t in nlp_terms}
        nlp_terms = nlp_terms + [t for t in _keyword_seed_terms(keyword) if t["term"] not in existing]
    targets = _compute_targets(serp_texts, soups)

    result = {
        "terms": nlp_terms,
        "paa_questions": paa_questions,
        "competitors": [
            {
                "url": result["link"],
                "domain": domain_from_url(result["link"]),
                "title": result.get("title", ""),
                "snippet": result.get("snippet", ""),
            }
            for result in serp_results[:10]
        ],
        **targets,
    }
    if include_texts:
        result["_competitor_texts"] = serp_texts
    return result


async def _fetch_serp_results(keyword: str, language: str, num: int, api_key: str) -> list[dict]:
    lang_to_gl = {
        "pl": "pl", "en": "us", "de": "de", "fr": "fr",
        "es": "es", "it": "it", "nl": "nl", "pt": "pt",
    }
    gl = lang_to_gl.get(language, "us")
    negatives_by_lang = {
        "pl": "-przesylka -paczka -kurier -nadanie -zamowienie -cena -sklep -allegro -olx",
        "en": "-price -buy -shop -amazon -ebay -etsy -walmart -order -shipping -tracking",
        "de": "-preis -kaufen -shop -amazon -ebay -bestellung -versand",
    }
    query = f"{keyword} {negatives_by_lang.get(language, negatives_by_lang['en'])}"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "hl": language, "gl": gl, "num": num + 5},
            )
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        print(f"[serp_analyzer] serper.dev error: {exc}")
        return []

    blocked_domains = {
        "allegro.pl", "olx.pl", "amazon.com", "amazon.de", "ebay.com", "etsy.com",
        "alibaba.com", "aliexpress.com", "ceneo.pl", "walmart.com", "shopee.pl",
        "erli.pl",
    }

    results = []
    for item in data.get("organic", []):
        link = item.get("link", "")
        if not link:
            continue
        domain = domain_from_url(link)
        if any(blocked in domain for blocked in blocked_domains):
            continue
        results.append({
            "title": item.get("title", ""),
            "link": link,
            "snippet": item.get("snippet", ""),
            "date": item.get("date", ""),
        })

    paa_questions = [
        item.get("question", "").strip()
        for item in data.get("peopleAlsoAsk", [])
        if item.get("question")
    ][:8]

    return results[:num], paa_questions


async def _fetch_serp_urls(keyword: str, language: str, num: int, api_key: str) -> list[str]:
    results, _ = await _fetch_serp_results(keyword, language, num, api_key)
    return [r["link"] for r in results]


async def _scrape_pages(urls: list[str]) -> tuple[list[str], list[BeautifulSoup]]:
    async def _fetch_one(client: httpx.AsyncClient, url: str):
        try:
            response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            html = response.text
            # SPA fallback: if content looks thin, retry with headless browser
            text_check = parse_html(html).get_text(separator=" ", strip=True)
            if len(text_check) < 200:
                rendered = await _fetch_via_spa_fallback(url, text_check)
                if rendered:
                    html = rendered

            soup = parse_html(html)
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            text = soup.get_text(separator=" ", strip=True)
            return (text[:15000], soup)
        except Exception as exc:
            print(f"[serp_analyzer] Failed to scrape {url}: {exc}")
            return ("", None)

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        results = await asyncio.gather(*(_fetch_one(client, url) for url in urls), return_exceptions=False)

    texts = [r[0] for r in results if r[1] is not None]
    soups = [r[1] for r in results if r[1] is not None]
    return texts, soups


def _extract_nlp_terms(texts: list[str], keyword: str) -> list[dict]:
    """Backward-compatible alias — implementation lives in competitor_terms."""
    from analyzers.competitor_terms import extract_nlp_terms
    return extract_nlp_terms(texts, keyword)


def _compute_targets(texts: list[str], soups: list[BeautifulSoup] | None = None) -> dict:
    if not texts:
        return {
            "words_min": 1500,
            "words_max": 3000,
            "words_target": 2200,
            "headings_min": 10,
            "headings_max": 25,
            "headings_target": 15,
            "paragraphs_min": 10,
            "paragraphs_max": 40,
            "paragraphs_target": 20,
        }

    word_counts = [len(text.split()) for text in texts]
    if soups:
        heading_counts = [max(1, len(soup.select("h1,h2,h3,h4"))) for soup in soups]
        paragraph_counts = [
            max(1, len([p for p in soup.select("p") if len(p.get_text().split()) >= 3]))
            for soup in soups
        ]
    else:
        heading_counts = [max(5, wc // 150) for wc in word_counts]
        paragraph_counts = [max(5, wc // 120) for wc in word_counts]

    return {
        "words_min": int(min(word_counts)),
        "words_max": int(max(word_counts)),
        "words_target": int(sum(word_counts) / len(word_counts)),
        "headings_min": max(3, min(heading_counts)),
        "headings_max": max(8, max(heading_counts)),
        "headings_target": int(sum(heading_counts) / len(heading_counts)),
        "paragraphs_min": max(5, min(paragraph_counts)),
        "paragraphs_max": max(20, max(paragraph_counts)),
        "paragraphs_target": int(sum(paragraph_counts) / len(paragraph_counts)),
    }


# Polish/EN stopwords kept short — only what we need to drop junk single tokens
_SEED_STOPWORDS = {
    "the", "and", "for", "with", "you", "your", "jak", "czy", "oraz", "dla",
    "lub", "ale", "nie", "tak", "co", "to", "na", "do", "od", "po", "za", "we", "ze",
}


def _keyword_seed_terms(keyword: str) -> list[dict]:
    """Build a language-correct fallback term set from the keyword itself.

    Never invents foreign-language terms — derives everything from the user's own
    keyword, so a Polish article gets Polish entities, not English placeholders.
    """
    kw = (keyword or "").strip()
    if not kw:
        return []
    def _seed(term: str, target: int, type_: str) -> dict:
        return {
            "term": term, "target_count": target, "type": type_,
            "relevance": 0.9 if type_ == "core" else 0.6, "doc_freq": 1,
            "suggested_min": 1, "suggested_max": target,
        }
    terms = [_seed(kw.lower(), 4, "core")]
    for token in kw.lower().split():
        token = re.sub(r"[^\wąćęłńóśźż]+", "", token)
        if len(token) >= 4 and token not in _SEED_STOPWORDS and token != kw.lower():
            terms.append(_seed(token, 2, "supporting"))
    # dedupe, cap
    seen: set[str] = set()
    out: list[dict] = []
    for t in terms:
        if t["term"] not in seen:
            seen.add(t["term"])
            out.append(t)
    return out[:6]


def _placeholder_score_data(keyword: str = "") -> dict:
    return {
        "terms": _keyword_seed_terms(keyword),
        "words_min": 1500,
        "words_max": 3000,
        "words_target": 2200,
        "headings_min": 10,
        "headings_max": 25,
        "headings_target": 15,
    }


async def extract_competitor_outlines(keyword: str, language: str = "pl", num: int = 5) -> list[dict]:
    serper_key = os.getenv("SERPER_API_KEY", "")
    if not serper_key:
        return []

    # Fetch more results than needed so we can skip thin/error pages
    results, _ = await _fetch_serp_results(keyword, language, num * 2, serper_key)

    async def _fetch_one(client: httpx.AsyncClient, result: dict, serp_position: int):
        url = result["link"]
        try:
            response = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            html = response.text

            # SPA fallback: if content is thin, retry with headless browser
            text_check = parse_html(html).get_text(" ", strip=True)
            if len(text_check.split()) < 200:
                rendered = await _fetch_via_spa_fallback(url, text_check)
                if rendered:
                    html = rendered

            soup = parse_html(html)
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            text = soup.get_text(" ", strip=True)
            word_count = len(text.split())

            # Reject thin-content pages (JS-rendered SPAs, cookie walls, errors)
            if word_count < 200:
                print(f"[serp_analyzer] skipping thin page ({word_count} words): {url}")
                return None

            headings = [
                {"level": int(tag.name[1]), "text": tag.get_text(" ", strip=True)}
                for tag in soup.select("h1,h2,h3,h4")
                if tag.get_text(" ", strip=True)
            ]
            heading_count = len(headings)
            title_tag = soup.select_one("title")
            return {
                "url": url,
                "domain": domain_from_url(url),
                "title": title_tag.get_text(" ", strip=True) if title_tag else result.get("title", ""),
                "serp_title": result.get("title", ""),
                "snippet": result.get("snippet", ""),
                "word_count": word_count,
                "heading_count": heading_count,
                "serp_position": serp_position,
                "headings": headings[:60],
            }
        except Exception as exc:
            print(f"[serp_analyzer] outline failed for {url}: {exc}")
            return None

    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        tasks = [_fetch_one(client, r, i + 1) for i, r in enumerate(results)]
        all_outlines = await asyncio.gather(*tasks, return_exceptions=False)

    # Filter thin/failed pages, keep top `num` by original SERP order
    valid = [o for o in all_outlines if o is not None]
    return valid[:num]

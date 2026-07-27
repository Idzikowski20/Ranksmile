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
from pipeline.ssrf_guard import ssrf_safe_get


# ── SPA fallback: use Next.js headless browser endpoint for JS-rendered pages ──
from service_urls import nextjs_url


async def _fetch_via_spa_fallback(url: str, plain_text: str) -> str | None:
    """If plain-text content is thin (< 200 chars), retry via headless browser."""
    if len(plain_text) >= 200:
        return None  # Content is fine, no need for fallback

    try:
        async with httpx.AsyncClient(timeout=25) as client:
            resp = await client.post(
                f"{nextjs_url()}/api/render-page",
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


def _competitors_from_results(serp_results: list[dict], limit: int = 10) -> list[dict]:
    """SERP URLs/titles/snippets — always returned even when page scrape fails."""
    return [
        {
            "url": row["link"],
            "domain": domain_from_url(row["link"]),
            "title": row.get("title", ""),
            "snippet": row.get("snippet", ""),
        }
        for row in serp_results[:limit]
        if row.get("link")
    ]


BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

_NON_HTML_EXT = (".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".zip", ".rar")


def _is_html_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    return not any(path.endswith(ext) for ext in _NON_HTML_EXT)


def _serp_snippet_texts(serp_results: list[dict]) -> list[str]:
    """Fallback corpus when page scrapes fail — title + snippet still yield usable terms."""
    texts: list[str] = []
    for row in serp_results:
        blob = " ".join(
            part.strip()
            for part in (row.get("title") or "", row.get("snippet") or "")
            if part and part.strip()
        ).strip()
        if len(blob.split()) >= 5:
            texts.append(blob)
    return texts


async def analyze_serp(keyword: str, language: str = "pl", num_results: int = 10, include_texts: bool = False) -> dict:
    serper_key = os.getenv("SERPER_API_KEY", "")

    if not serper_key:
        print("[serp_analyzer] No SERPER_API_KEY - using keyword seed data")
        return {**_placeholder_score_data(keyword), "competitors": [], "paa_questions": []}

    serp_results, paa_questions = await _fetch_serp_results(keyword, language, num_results, serper_key)
    competitors = _competitors_from_results(serp_results)
    if not serp_results:
        print(f"[serp_analyzer] No SERP results for {keyword!r}")
        return {**_placeholder_score_data(keyword), "competitors": [], "paa_questions": paa_questions}

    scrapeable = [r["link"] for r in serp_results if r.get("link") and _is_html_url(r["link"])]
    skipped = len(serp_results) - len(scrapeable)
    if skipped:
        print(f"[serp_analyzer] skipping {skipped} non-HTML SERP URLs (pdf/docs)")

    serp_texts, soups = await _scrape_pages(scrapeable) if scrapeable else ([], [])
    snippet_texts = _serp_snippet_texts(serp_results)

    # Prefer scraped bodies; if thin/empty, fall back to SERP snippets so term extraction
    # and AI corpus still have signal (datacenter IPs often get soft-blocked by Wikipedia etc.).
    if not serp_texts:
        print(
            f"[serp_analyzer] SERP scrape failed for all {len(scrapeable)} HTML URLs — "
            f"using {len(snippet_texts)} title+snippet texts"
        )
        serp_texts = snippet_texts
        soups = []
    elif len(serp_texts) < 3 and snippet_texts:
        print(
            f"[serp_analyzer] only {len(serp_texts)} scraped pages — "
            f"merging {len(snippet_texts)} SERP snippets"
        )
        serp_texts = serp_texts + snippet_texts

    deepseek_key = os.getenv("DEEPSEEK_API_KEY", "")
    nlp_terms = await extract_semantic_terms(keyword, serp_texts, deepseek_key) if serp_texts else []
    if len(nlp_terms) < 3:
        existing = {t["term"] for t in nlp_terms}
        nlp_terms = nlp_terms + [t for t in _keyword_seed_terms(keyword) if t["term"] not in existing]
    targets = _compute_targets(serp_texts, soups if soups else None)

    result = {
        "terms": nlp_terms,
        "paa_questions": paa_questions,
        "competitors": competitors,
        **targets,
    }
    if include_texts:
        result["_competitor_texts"] = serp_texts
    print(
        f"[serp_analyzer] done keyword={keyword!r}: "
        f"{len(competitors)} competitors, {len(serp_texts)} texts, {len(nlp_terms)} terms, "
        f"{len(paa_questions)} PAA"
    )
    return result


async def _scrape_pages(urls: list[str]) -> tuple[list[str], list[BeautifulSoup]]:
    scrape_headers = {
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
    }

    async def _fetch_one(url: str, *, verify: bool = True):
        try:
            response = await ssrf_safe_get(
                url,
                headers=scrape_headers,
                timeout=15,
                verify=verify,
            )
            if response.status_code >= 400:
                print(f"[serp_analyzer] HTTP {response.status_code} for {url}")
                return ("", None)
            html = response.text
            text_check = parse_html(html).get_text(separator=" ", strip=True)
            if len(text_check.split()) < 200:
                rendered = await _fetch_via_spa_fallback(url, text_check)
                if rendered:
                    html = rendered

            soup = parse_html(html)
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            text = soup.get_text(separator=" ", strip=True)
            words = len(text.split())
            if words < 50:
                print(f"[serp_analyzer] skipping thin page ({words} words): {url}")
                return ("", None)
            return (text[:15000], soup)
        except Exception as exc:
            msg = str(exc)
            if verify and ("CERTIFICATE_VERIFY_FAILED" in msg or "SSL" in msg):
                print(f"[serp_analyzer] SSL error for {url} — retrying without verify")
                try:
                    return await _fetch_one(url, verify=False)
                except Exception as retry_exc:
                    print(f"[serp_analyzer] Failed to scrape {url}: {retry_exc}")
                    return ("", None)
            print(f"[serp_analyzer] Failed to scrape {url}: {exc}")
            return ("", None)

    results = await asyncio.gather(*(_fetch_one(url) for url in urls), return_exceptions=False)

    texts = [r[0] for r in results if r[1] is not None]
    soups = [r[1] for r in results if r[1] is not None]
    return texts, soups


async def _fetch_serp_results(keyword: str, language: str, num: int, api_key: str) -> tuple[list[dict], list[str]]:
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
    negatives = negatives_by_lang.get(language, negatives_by_lang["en"])

    async def _serper_search(query: str) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "hl": language, "gl": gl, "num": num + 5},
            )
            if response.status_code >= 400:
                print(
                    f"[serp_analyzer] serper.dev HTTP {response.status_code}: "
                    f"{response.text[:300]}"
                )
                response.raise_for_status()
            return response.json()

    try:
        data = await _serper_search(f"{keyword} {negatives}")
    except Exception as exc:
        print(f"[serp_analyzer] serper.dev error: {exc}")
        return [], []

    organic = data.get("organic") or []
    if not organic:
        # Negatives sometimes over-filter; retry the bare keyword once.
        print(
            f"[serp_analyzer] empty organic for {keyword!r} (gl={gl} hl={language}) — "
            f"retrying without negatives; keys={list(data.keys())}"
        )
        try:
            data = await _serper_search(keyword)
            organic = data.get("organic") or []
        except Exception as exc:
            print(f"[serp_analyzer] serper.dev retry error: {exc}")
            return [], []

    blocked_domains = {
        "allegro.pl", "olx.pl", "amazon.com", "amazon.de", "ebay.com", "etsy.com",
        "alibaba.com", "aliexpress.com", "ceneo.pl", "walmart.com", "shopee.pl",
        "erli.pl",
        # Social / video — almost never yield usable article body text for NLP terms
        "youtube.com", "youtu.be", "facebook.com", "fb.com", "instagram.com",
        "tiktok.com", "twitter.com", "x.com", "linkedin.com", "reddit.com",
    }

    results = []
    for item in organic:
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
    ]

    # Serper often returns relatedSearches when peopleAlsoAsk is empty — still useful
    # for AI Search "Info to cover" curation on the Node side.
    related_raw = data.get("relatedSearches") or []
    for row in related_raw:
        q = (row.get("query") if isinstance(row, dict) else str(row or "")).strip()
        if q and q not in paa_questions:
            paa_questions.append(q)

    paa_questions = paa_questions[:12]

    if not results:
        print(
            f"[serp_analyzer] No usable organic after filters for {keyword!r} "
            f"(raw organic={len(organic)}, gl={gl})"
        )

    return results[:num], paa_questions


async def _fetch_serp_urls(keyword: str, language: str, num: int, api_key: str) -> list[str]:
    results, _ = await _fetch_serp_results(keyword, language, num, api_key)
    return [r["link"] for r in results]


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
        "competitors": [],
        "paa_questions": [],
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

    async def _fetch_one(result: dict, serp_position: int):
        url = result["link"]
        try:
            response = await ssrf_safe_get(
                url,
                headers={"User-Agent": "Mozilla/5.0"},
                timeout=10,
            )
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

    tasks = [_fetch_one(r, i + 1) for i, r in enumerate(results)]
    all_outlines = await asyncio.gather(*tasks, return_exceptions=False)

    # Filter thin/failed pages, keep top `num` by original SERP order
    valid = [o for o in all_outlines if o is not None]
    return valid[:num]

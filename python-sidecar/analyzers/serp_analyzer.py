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


# Reference sites, not competitors. A one-word definitional keyword ("szantaż") returns
# dictionaries, translators and music databases — benchmarking an article against them
# poisons everything downstream: junk NLP terms (cookie banners, URL fragments), word
# targets from 400-word dictionary stubs, and planner sections about etymology and
# pronunciation. These domains can never be the article's real competition.
_REFERENCE_DOMAINS = (
    "dictionary.cambridge.org", "sjp.pwn.pl", "sjp.pl", "wsjp.pl", "pl.wiktionary.org",
    "wiktionary.org", "bab.la", "glosbe.com", "diki.pl", "translate.google.",
    "ling.pl", "dict.cc", "reverso.net", "linguee.", "pons.com", "collinsdictionary.com",
    "merriam-webster.com", "dictionary.com", "thefreedictionary.com",
    "discogs.com", "genius.com", "tekstowo.pl", "spotify.com", "music.apple.com",
    "youtube.com", "youtu.be", "soundcloud.com", "last.fm", "rateyourmusic.com",
)


def _is_reference_domain(url: str) -> bool:
    host = domain_from_url(url).lower()
    return any(host == d or host.endswith("." + d) or d in host for d in _REFERENCE_DOMAINS)


def _filter_reference_results(serp_results: list[dict]) -> list[dict]:
    """Drop dictionary/translator/music results, unless that starves the benchmark
    (< 3 left) — a definitional SERP with nothing else is still the only data there is."""
    kept = [r for r in serp_results if not _is_reference_domain(r.get("link", ""))]
    dropped = len(serp_results) - len(kept)
    if dropped:
        print(f"[serp_analyzer] dropped {dropped} reference-site results (dictionary/music)")
    return kept if len(kept) >= 3 else serp_results


def _competitors_from_results(serp_results: list[dict], limit: int = 20) -> list[dict]:
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


async def analyze_serp(
    keyword: str,
    language: str = "pl",
    num_results: int = 20,
    include_texts: bool = False,
    on_page=None,
) -> dict:
    serper_key = os.getenv("SERPER_API_KEY", "")

    if not serper_key:
        print("[serp_analyzer] No SERPER_API_KEY - using keyword seed data")
        return {**_placeholder_score_data(keyword, language), "competitors": [], "paa_questions": []}

    serp_results, paa_questions = await _fetch_serp_results(keyword, language, num_results, serper_key)
    serp_results = _filter_reference_results(serp_results)
    competitors = _competitors_from_results(serp_results)
    if not serp_results:
        print(f"[serp_analyzer] No SERP results for {keyword!r}")
        return {**_placeholder_score_data(keyword, language), "competitors": [], "paa_questions": paa_questions}

    scrapeable = [r["link"] for r in serp_results if r.get("link") and _is_html_url(r["link"])]
    skipped = len(serp_results) - len(scrapeable)
    if skipped:
        print(f"[serp_analyzer] skipping {skipped} non-HTML SERP URLs (pdf/docs)")

    serp_texts, soups = await _scrape_pages(scrapeable, on_page) if scrapeable else ([], [])
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
    nlp_terms = await extract_semantic_terms(keyword, serp_texts, deepseek_key, language) if serp_texts else []
    if len(nlp_terms) < 3:
        existing = {t["term"] for t in nlp_terms}
        nlp_terms = nlp_terms + [t for t in _keyword_seed_terms(keyword) if t["term"] not in existing]
    # After the fallback merge, so seed terms get their inflections too.
    from analyzers.term_lemmas import attach_lemma_regexps, recalibrate_ranges_with_lemmas
    nlp_terms = attach_lemma_regexps(nlp_terms, serp_texts, language)
    # Ranges re-derived with the lemma patterns the scorer uses — see the helper's doc.
    nlp_terms = recalibrate_ranges_with_lemmas(nlp_terms, serp_texts)
    # Surfer separates "terms for headings": a term the cohort itself puts into H2/H3
    # belongs in the article's structure, not only its body.
    heading_text = " ".join(
        tag.get_text(" ", strip=True).lower()
        for soup in (soups or [])
        for tag in soup.select("h2,h3")
    )
    if heading_text:
        for t in nlp_terms:
            if t.get("term") and t["term"].lower() in heading_text:
                t["in_headings"] = True
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


async def _scrape_pages(
    urls: list[str],
    on_page=None,
) -> tuple[list[str], list[BeautifulSoup]]:
    """on_page(finished, total, url) fires as each page settles, so the editor can show
    "Crawling result 6/10". Pages are fetched concurrently, so the counter is arrival
    order, not list order."""
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
            # 40k chars, not 15k: the reference tool's own structure guideline for a SERP
            # measured competitor pages at 17 957-52 190 characters, so a 15k cap read
            # every long article as ~2 100 words and the word target came out at a
            # fraction of what actually ranks.
            return (text[:40000], soup)
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

    total = len(urls)
    finished = 0

    async def _fetch_and_report(url: str):
        nonlocal finished
        result = await _fetch_one(url)
        finished += 1
        if on_page:
            try:
                await on_page(finished, total, url)
            except Exception as exc:  # progress must never break the scrape
                print(f"[serp_analyzer] progress callback failed: {exc}")
        return result

    results = await asyncio.gather(
        *(_fetch_and_report(url) for url in urls), return_exceptions=False,
    )

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

    async def _serper_search(query: str, page: int = 1) -> dict:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "hl": language, "gl": gl, "num": num + 5, "page": page},
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
    used_query = f"{keyword} {negatives}"
    if not organic:
        # Negatives sometimes over-filter; retry the bare keyword once.
        print(
            f"[serp_analyzer] empty organic for {keyword!r} (gl={gl} hl={language}) — "
            f"retrying without negatives; keys={list(data.keys())}"
        )
        try:
            data = await _serper_search(keyword)
            organic = data.get("organic") or []
            used_query = keyword
        except Exception as exc:
            print(f"[serp_analyzer] serper.dev retry error: {exc}")
            return [], []

    # Deep cohort: Surfer benchmarks against ~19 competitors, but Google returns only
    # ~8-10 organic per page for many keywords, so one page yielded a thinner, easier
    # term set than Surfer's. Pull pages 2-3 as well (deduped by link) when a deep sample
    # was asked for — page 1 (~9) + 2 (~10) + 3 gets the raw pool to ~19 like Surfer, and
    # bands (serp_usage) + word/heading targets come from that same Surfer-sized cohort.
    if num > 10:
        seen_links = {i.get("link") for i in organic}
        for page in (2, 3):
            try:
                extra = await _serper_search(used_query, page=page)
            except Exception as exc:
                print(f"[serp_analyzer] page-{page} fetch skipped: {exc}")
                continue
            page_organic = extra.get("organic") or []
            if not page_organic:
                break  # no deeper results — stop paging
            for it in page_organic:
                if it.get("link") and it["link"] not in seen_links:
                    seen_links.add(it["link"])
                    organic.append(it)
            if len(organic) >= num:
                break  # enough for the requested cohort

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

    # A page that would not scrape falls back to title+snippet (~30 words) — that is
    # missing data, not evidence of a short article, and averaging it in dragged
    # words_target for "szantaż" down to 675 against the reference tool's 2353-2706.
    # Snippet-length texts only count when there is nothing better to measure.
    # ponytail: 200 words as the "real article vs snippet fallback" line — a genuine
    # 50-199-word page is misread as a snippet when 2+ longer pages exist. Upgrade path:
    # pass scrape-vs-snippet provenance from analyze_serp instead of inferring by length.
    full_counts = [n for n in (len(text.split()) for text in texts) if n >= 200]
    word_counts = full_counts if len(full_counts) >= 2 else [len(text.split()) for text in texts]
    if soups:
        heading_counts = [max(1, len(soup.select("h1,h2,h3,h4"))) for soup in soups]
        paragraph_counts = [
            max(1, len([p for p in soup.select("p") if len(p.get_text().split()) >= 3]))
            for soup in soups
        ]
    else:
        heading_counts = [max(5, wc // 150) for wc in word_counts]
        paragraph_counts = [max(5, wc // 120) for wc in word_counts]
    image_counts = [len(soup.select("img")) for soup in soups] if soups else []

    # Floors: a SERP of dictionary stubs and thin listicles must not cap a real article.
    # An article longer than everything that ranks is not a defect — never grade words
    # against a max lower than what a competent guide needs.
    # ponytail: fixed floors; derive from content type if service pages ever need less.
    avg_words = int(sum(word_counts) / len(word_counts))
    words_target = max(avg_words, 800)

    # Structure as a per-word ratio, scaled to the word target — Surfer's model
    # (`guidelines_baseline: word_count`): for "szantaż emocjonalny" its heading guideline
    # is min 0.004735 / avg 0.008838 / max 0.021044 per word, which at 2600 words is a
    # band of 12.3–54.7 and a suggested 23. Averaging raw counts let a 3000-word page
    # with 60 headings and a 1000-word page with 5 vote as equals, so the target described
    # neither the SERP's density nor the article about to be written against it. The
    # ratio is measured on the same "real page" set as the word target: a snippet
    # fallback has no structure and must not pull the floor to zero.
    if soups:
        page_words = [len(text.split()) for text in texts[: len(soups)]]
        real = [i for i, n in enumerate(page_words) if n >= 200 and i < len(soups)]
        if len(real) < 2:
            real = [i for i in range(len(soups)) if page_words[i] > 0]

        def band(counts: list[int]) -> tuple[int, int, int]:
            ratios = [counts[i] / page_words[i] for i in real if i < len(counts)]
            if not ratios:
                return (0, 0, 0)
            avg = sum(ratios) / len(ratios)
            return (
                int(round(avg * words_target)),
                int(round(min(ratios) * words_target)),
                int(round(max(ratios) * words_target)),
            )

        h_target, h_min, h_max = band(heading_counts)
        p_target, p_min, p_max = band(paragraph_counts)
        i_target, i_min, i_max = band(image_counts)
    else:
        h_target, h_min, h_max = (
            int(sum(heading_counts) / len(heading_counts)), min(heading_counts), max(heading_counts),
        )
        p_target, p_min, p_max = (
            int(sum(paragraph_counts) / len(paragraph_counts)), min(paragraph_counts), max(paragraph_counts),
        )
        i_target = i_min = i_max = 0

    return {
        "words_min": int(min(word_counts)),
        "words_max": max(int(max(word_counts)), 1200),
        "words_target": words_target,
        "headings_min": max(3, h_min),
        # Floored like words: a reference article carries 12-15 H2s, and a cohort of
        # short pages must not turn a well-structured article into a penalty.
        "headings_max": max(12, h_max),
        "headings_target": max(8, h_target),
        "paragraphs_min": max(5, p_min),
        "paragraphs_max": max(20, p_max),
        "paragraphs_target": p_target,
        # Image frequency from the cohort (Surfer measures it; zero-image cohorts emit
        # target 0 and the scorer skips the slot).
        **({
            "images_min": i_min,
            "images_max": max(3, i_max),
            "images_target": i_target,
        } if image_counts else {}),
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


def _placeholder_score_data(keyword: str = "", language: str = "pl") -> dict:
    from analyzers.term_lemmas import attach_lemma_regexps
    # Seed terms carry their inflection regexps too, so the no-Serper / no-results
    # fallback matches and dedupes the same way a full analysis does (empty corpus →
    # base form + stem, which is enough for the scorer to count declensions).
    # `language` is threaded through rather than pinned to "pl": attach_lemma_regexps
    # only annotates Polish, and hardcoding it here made the fallback path disagree
    # with the full path for every other language.
    return {
        "terms": attach_lemma_regexps(_keyword_seed_terms(keyword), [], language),
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
    # Same reference filter as analyze_serp: the outlines feed the Competitors panel and
    # the planner, and dictionary/translator pages poisoned both for one-word keywords.
    results = _filter_reference_results(results)

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


# ── Authority fact research (Surfer "Facts"-style) ──────────────────────────
# Real cases and statistics with their sources, found on the open web — the fact
# sheet pairs each with [źródło: …] so the writer can cite a named case instead of
# writing an article with zero evidence. Deterministic: Serper snippets only, no LLM.

_AUTHORITY_HOSTS = (
    ".gov.pl", "policja.gov.pl", "prokuratura", "sejm.gov.pl", "uokik.gov.pl",
    "nask.pl", "cert.pl", "rpo.gov.pl", "stat.gov.pl", ".edu.pl", "europa.eu",
)


def _authority_confidence(url: str) -> float:
    host = domain_from_url(url).lower()
    return 0.85 if any(h in host for h in _AUTHORITY_HOSTS) else 0.6


async def _ai_surface_facts(keyword: str, language: str, serper_key: str) -> tuple[list[str], list[dict]]:
    """
    Facts from Google's own answer surfaces — the closest thing to Surfer's AI-engine
    facts that the available keys reach.

    Surfer harvests facts from Google AI Overviews / AI Mode, Gemini, OpenAI and
    Perplexity. We have Serper (Google) and OpenRouter, but no OpenAI/Perplexity keys,
    so full four-engine parity is out of reach. What we CAN read is Google's featured
    answer, knowledge panel and People-Also-Ask answers — Google's surfaced facts,
    already sourced, no model hallucination. Honest partial coverage.
    """
    gl = {"pl": "pl", "en": "us", "de": "de", "fr": "fr", "es": "es"}.get(language, "us")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": serper_key, "Content-Type": "application/json"},
                json={"q": keyword, "hl": language, "gl": gl},
            )
        if resp.status_code != 200:
            return [], []
        data = resp.json()
    except Exception as exc:
        print(f"[fact-research] AI-surface fetch failed: {exc}")
        return [], []

    claims: list[str] = []
    sources: list[dict] = []
    seen: set[str] = set()

    def _add(text: str, url: str, label: str) -> None:
        text = " ".join(str(text or "").split())
        if len(text) < 40 or text.lower() in seen:
            return
        seen.add(text.lower())
        claims.append(text[:240])
        sources.append({"url": url or "", "source_urls": [url] if url else [], "label": (label or "Google")[:80], "confidence": 0.8, "cited_by": ["google"]})

    box = data.get("answerBox") or {}
    _add(box.get("answer") or box.get("snippet"), box.get("link", ""), box.get("title") or "Google answer")
    kg = data.get("knowledgeGraph") or {}
    _add(kg.get("description"), kg.get("descriptionLink", ""), kg.get("title") or "Google knowledge panel")
    for paa in (data.get("peopleAlsoAsk") or [])[:6]:
        _add(paa.get("snippet"), paa.get("link", ""), paa.get("question") or "People also ask")

    if claims:
        print(f"[fact-research] {keyword!r}: {len(claims)} facts from Google answer surfaces")
    return claims, sources


# Surfer harvests facts each AI engine cites when answering the query. OpenRouter reaches
# the same engines through one key: perplexity (native web+citations) and gpt-4o-mini /
# gemini-flash with the `:online` web-search plugin. Each returns `annotations` with the
# source URLs the model cited — the same signal as Surfer's `cited_by`.
_AI_ENGINES = (
    ("perplexity", "perplexity/sonar"),
    ("openai", "openai/gpt-4o-mini:online"),
    ("gemini", "google/gemini-2.5-flash:online"),
)


async def _ai_engine_facts(keyword: str, language: str, openrouter_key: str) -> tuple[list[str], list[dict]]:
    """Facts perplexity / openai / gemini cite for the query, each tagged with its engine
    (Surfer `cited_by` parity). One OpenRouter key; models do the web search themselves."""
    if not openrouter_key or not keyword.strip():
        return [], []
    lang_hint = "Odpowiedz po polsku." if language.startswith("pl") else ""
    prompt = (
        f'Wypisz 6 konkretnych, sprawdzalnych faktów o temacie: "{keyword}". '
        f"Każdy fakt w osobnej linii — jedno zdanie, z liczbą, definicją lub konkretem. "
        f"Bez wstępu i bez numeracji. {lang_hint}"
    )

    async def _one(engine: str, model: str) -> tuple[list[str], list[dict]]:
        try:
            async with httpx.AsyncClient(timeout=45) as client:
                resp = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openrouter_key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": [{"role": "user", "content": prompt}], "max_tokens": 700},
                )
            if resp.status_code != 200:
                print(f"[fact-research] {engine} HTTP {resp.status_code}: {resp.text[:120]}")
                return [], []
            message = resp.json()["choices"][0]["message"]
        except Exception as exc:
            print(f"[fact-research] {engine} failed: {exc}")
            return [], []
        content = message.get("content") or ""
        urls = [
            a.get("url_citation", {}).get("url")
            for a in (message.get("annotations") or [])
            if isinstance(a, dict) and a.get("url_citation", {}).get("url")
        ]
        claims: list[str] = []
        sources: list[dict] = []
        for line in content.split("\n"):
            stripped = re.sub(r"^[\s\-\*\d\.\)\]]+", "", line)
            # `[n]` markers map a sentence to the engine's nth citation (perplexity/OpenRouter
            # style). Collect those specific sources before stripping the markers off the text.
            marker_urls = [
                urls[int(n) - 1]
                for n in re.findall(r"\[(\d+)\]", stripped)
                if 0 < int(n) <= len(urls)
            ]
            text = re.sub(r"\[\d+\]", "", stripped).strip()
            if len(text) < 40:
                continue
            # Fall back to the response's cited URLs when a sentence carries no explicit marker.
            fact_urls = list(dict.fromkeys(marker_urls or urls))
            claims.append(text[:240])
            sources.append({
                "url": fact_urls[0] if fact_urls else "",
                "source_urls": fact_urls[:6],
                "label": engine,
                "confidence": 0.85,
                "cited_by": [engine],
            })
        return claims, sources

    results = await asyncio.gather(*[_one(e, m) for e, m in _AI_ENGINES])
    claims: list[str] = []
    sources: list[dict] = []
    seen: dict[str, dict] = {}
    for engine_claims, engine_sources in results:
        for claim, src in zip(engine_claims, engine_sources):
            key = " ".join(claim.lower().split())[:120]
            if key in seen:
                # Same fact from another engine — merge attribution (engines + source URLs)
                # instead of duplicating, exactly as Surfer stacks icons on one fact.
                prev = seen[key]
                for e in src["cited_by"]:
                    if e not in prev["cited_by"]:
                        prev["cited_by"].append(e)
                merged = list(dict.fromkeys(prev.get("source_urls", []) + src.get("source_urls", [])))
                prev["source_urls"] = merged[:8]
                if not prev.get("url") and merged:
                    prev["url"] = merged[0]
                continue
            seen[key] = src
            claims.append(claim)
            sources.append(src)
    if claims:
        by = {}
        for s in sources:
            for e in s["cited_by"]:
                by[e] = by.get(e, 0) + 1
        print(f"[fact-research] {keyword!r}: {len(claims)} AI-engine facts {by}")
    return claims, sources


async def research_authority_facts(keyword: str, language: str = "pl") -> dict:
    """AI-engine facts (perplexity/openai/gemini) + Google surfaces + focused SERP searches."""
    serper_key = os.getenv("SERPER_API_KEY", "")
    if not serper_key or not keyword.strip():
        return {"claims": [], "sources": []}

    # Real 4-engine harvest: the AI engines via OpenRouter, then Google's own answer surfaces.
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    engine_claims, engine_sources = await _ai_engine_facts(keyword, language, openrouter_key)
    surface_claims, surface_sources = await _ai_surface_facts(keyword, language, serper_key)
    ai_claims = engine_claims + surface_claims
    ai_sources = engine_sources + surface_sources

    # Three profiles, matching the reference guideline's fact mix: legal cases,
    # statistics, and the psychology declaratives ("skutki", "mechanizmy") that made up
    # most of the 14 reference facts our harvest was missing.
    suffixes = (
        [
            "policja OR prokuratura OR sąd OR wyrok",
            "statystyki OR raport OR badania",
            "skutki OR objawy OR mechanizmy OR przyczyny",
        ]
        if language.startswith("pl")
        else [
            "police OR court OR case",
            "statistics OR report OR study",
            "effects OR symptoms OR mechanisms OR causes",
        ]
    )
    claims: list[str] = list(ai_claims)
    sources: list[dict] = list(ai_sources)
    seen_urls: set[str] = set()
    for suffix in suffixes:
        try:
            results, _ = await _fetch_serp_results(f"{keyword} {suffix}", language, 6, serper_key)
        except Exception as exc:
            print(f"[fact-research] search failed: {exc}")
            continue
        for row in results:
            url = row.get("link") or ""
            snippet = (row.get("snippet") or "").replace(chr(10), " ").strip()
            if not url or url in seen_urls or len(snippet) < 60:
                continue
            authority = any(h in domain_from_url(url).lower() for h in _AUTHORITY_HOSTS)
            has_numbers = bool(re.search(r"\d", snippet))
            if not authority and not has_numbers:
                continue
            seen_urls.add(url)
            claims.append(snippet[:220])
            sources.append({
                "url": url,
                "source_urls": [url],
                "label": row.get("title", "")[:80] or domain_from_url(url),
                "confidence": _authority_confidence(url),
                "cited_by": ["serp"],
            })
            if len(claims) >= 18:
                break
        if len(claims) >= 18:
            break
    print(f"[fact-research] {keyword!r}: {len(claims)} sourced facts")
    return {"claims": claims, "sources": sources}

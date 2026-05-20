"""
SERP Analyzer — pobiera top 10 wyników dla keyword przez serper.dev
i liczy TF-IDF terms (scikit-learn) oraz metryki struktury.

Klucz API: https://serper.dev  (2500 darmowych zapytań, potem ~$0.001/zapytanie)
Zmienna środowiskowa: SERPER_API_KEY
"""
import os
import httpx
from bs4 import BeautifulSoup
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np


async def analyze_serp(keyword: str, language: str = "pl", num_results: int = 10) -> dict:
    """
    Pobierz top 10 SERP i wylicz:
    - NLP terms (TF-IDF)
    - targets: word_count, heading_count
    """
    serper_key = os.getenv("SERPER_API_KEY", "")

    serp_urls: list[str] = []

    if serper_key:
        serp_urls = await _fetch_serp_urls(keyword, language, num_results, serper_key)
    else:
        print("[serp_analyzer] No SERPER_API_KEY — using placeholder data")
        print("[serp_analyzer] Get your free key at https://serper.dev")

    # Scrape top 10 stron
    if serp_urls:
        serp_texts, _ = await _scrape_pages(serp_urls)
    else:
        return _placeholder_score_data()

    # TF-IDF
    nlp_terms = _extract_nlp_terms(serp_texts, keyword)

    # Targets strukturalne
    targets = _compute_targets(serp_texts)

    return {
        "terms": nlp_terms,
        **targets,
    }


async def _fetch_serp_results(keyword: str, language: str, num: int, api_key: str) -> list[dict]:
    """Pobierz wyniki z serper.dev — zwraca listę {title, link, snippet, date}."""
    # Mapuj język na kraj (GL) dla lepszych wyników lokalnych
    lang_to_gl = {
        "pl": "pl", "en": "us", "de": "de", "fr": "fr",
        "es": "es", "it": "it", "nl": "nl", "pt": "pt",
    }
    gl = lang_to_gl.get(language, "us")

    # Build a smarter query that prefers articles/blogs over e-commerce/business listings
    # Add negative keywords to filter out common false positives
    negatives_by_lang = {
        "pl": "-przesyłka -paczka -kurier -nadanie -zamówienie -cena -sklep -allegro -olx",
        "en": "-price -buy -shop -amazon -ebay -etsy -walmart -order -shipping -tracking",
        "de": "-preis -kaufen -shop -amazon -ebay -bestellung -versand",
    }
    negatives = negatives_by_lang.get(language, negatives_by_lang["en"])

    # Construct query: keyword + article context + exclude noise
    query = f"{keyword} {negatives}"

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                "https://google.serper.dev/search",
                headers={
                    "X-API-KEY": api_key,
                    "Content-Type": "application/json",
                },
                json={
                    "q": query,
                    "hl": language,
                    "gl": gl,
                    "num": num + 5,
                },
            )
            r.raise_for_status()
            data = r.json()
            results = data.get("organic", [])

            # Filter out marketplace/e-commerce domains
            blocked_domains = {
                "allegro.pl", "olx.pl", "amazon.com", "amazon.de", "ebay.com",
                "etsy.com", "alibaba.com", "aliexpress.com", "ceneo.pl", "sklep.",
                "walmart.com", "shopee.pl", "erli.pl",
            }

            serp_results = []
            for res in results:
                link = res.get("link", "")
                if not link:
                    continue
                if any(b in link.lower() for b in blocked_domains):
                    continue
                serp_results.append({
                    "title": res.get("title", ""),
                    "link": link,
                    "snippet": res.get("snippet", ""),
                    "date": res.get("date", ""),
                })

            return serp_results[:num]
    except Exception as e:
        print(f"[serp_analyzer] serper.dev error: {e}")
        return []


async def _fetch_serp_urls(keyword: str, language: str, num: int, api_key: str) -> list[str]:
    """Backward-compat wrapper — zwraca tylko URLe."""
    results = await _fetch_serp_results(keyword, language, num, api_key)
    return [r["link"] for r in results]


async def _scrape_pages(urls: list[str]) -> tuple[list[str], list[BeautifulSoup]]:
    """Scrape tekst z listy URLi."""
    texts = []
    soups = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for url in urls:
            try:
                r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                soup = BeautifulSoup(r.text, "lxml")
                # Usuń skrypty i style
                for tag in soup(["script", "style", "nav", "footer"]):
                    tag.decompose()
                text = soup.get_text(separator=" ", strip=True)
                texts.append(text[:10000])
                soups.append(soup)
            except Exception as e:
                print(f"[serp_analyzer] Failed to scrape {url}: {e}")
    return texts, soups


def _extract_nlp_terms(texts: list[str], keyword: str) -> list[dict]:
    """TF-IDF z top 10 — wyciągnij terminy SEO."""
    if not texts:
        return []

    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 3),
            max_features=80,
            stop_words="english",
            min_df=1,
        )
        tfidf_matrix = vectorizer.fit_transform(texts)
        terms = vectorizer.get_feature_names_out()
        avg_scores = np.asarray(tfidf_matrix.mean(axis=0)).flatten()

        result = []
        for i, term in enumerate(terms):
            if avg_scores[i] > 0.02 and len(term) > 2:
                # target_count = ile razy powinien pojawić się w artykule
                target_count = max(1, round(avg_scores[i] * 15))
                result.append({"term": term, "target_count": int(target_count)})

        # Sortuj po ważności
        result.sort(key=lambda x: x["target_count"], reverse=True)
        return result[:50]

    except Exception as e:
        print(f"[serp_analyzer] TF-IDF error: {e}")
        return []


def _compute_targets(texts: list[str]) -> dict:
    """Wylicz target word/heading count z top 10."""
    if not texts:
        return {
            "words_min": 1500,
            "words_max": 3000,
            "words_target": 2200,
            "headings_min": 10,
            "headings_max": 25,
            "headings_target": 15,
        }

    word_counts = [len(t.split()) for t in texts]
    # Nie możemy łatwo liczyć nagłówków z tekstu — estymacja
    estimated_heading_counts = [max(5, wc // 150) for wc in word_counts]

    return {
        "words_min": int(min(word_counts) * 0.85),
        "words_max": int(max(word_counts) * 1.15),
        "words_target": int(sum(word_counts) / len(word_counts)),
        "headings_min": max(5, min(estimated_heading_counts)),
        "headings_max": max(10, max(estimated_heading_counts)),
        "headings_target": int(sum(estimated_heading_counts) / len(estimated_heading_counts)),
    }


def _placeholder_score_data() -> dict:
    """Zwraca placeholder gdy brak danych SERP."""
    return {
        "terms": [
            {"term": "seo", "target_count": 10},
            {"term": "content marketing", "target_count": 5},
            {"term": "keyword research", "target_count": 4},
            {"term": "backlinks", "target_count": 3},
            {"term": "on-page seo", "target_count": 3},
        ],
        "words_min": 1500,
        "words_max": 3000,
        "words_target": 2200,
        "headings_min": 10,
        "headings_max": 25,
        "headings_target": 15,
    }


async def extract_competitor_outlines(keyword: str, language: str = "pl", num_results: int = 5) -> list[dict]:
    """
    Pobiera top N wyników z serper.dev, scrapuje każdą stronę i zwraca
    strukturę headingów (h1-h3) + meta dane dla panelu Research & Outline.
    """
    serper_key = os.getenv("SERPER_API_KEY", "")
    if not serper_key:
        return []

    serp_results = await _fetch_serp_results(keyword, language, num_results, serper_key)
    if not serp_results:
        return []

    urls = [r["link"] for r in serp_results]

    # Scrape pages
    _, soups = await _scrape_pages(urls)

    results = []
    for i, (serp, (url, soup)) in enumerate(zip(serp_results, zip(urls, soups))):
        try:
            # Extract headings hierarchically
            headings = []
            for tag in soup.select("h1, h2, h3, h4"):
                level = int(tag.name[1])
                text = tag.get_text(strip=True)
                if text and len(text) > 2:
                    headings.append({"level": level, "text": text[:200]})

            # Page title — prefer scraped h1, fall back to SERP title
            page_title = ""
            h1 = soup.find("h1")
            if h1:
                page_title = h1.get_text(strip=True)
            if not page_title:
                page_title = serp.get("title", "")
            title_tag = soup.find("title")
            if not page_title and title_tag:
                page_title = title_tag.get_text(strip=True)

            # Favicon
            domain = url.split("/")[2] if "://" in url else url
            favicon = f"https://website-info.yourseo.pro/favicon/?domain={domain}"

            # Word count from body text (strip scripts/nav/etc first)
            for noise_tag in soup.select('script, style, nav, footer, header, aside, noscript'):
                noise_tag.decompose()
            body_text = soup.get_text(separator=' ')
            word_count_val = len(body_text.split())

            results.append({
                "url": url,
                "title": page_title or url,
                "serp_title": serp.get("title", ""),
                "snippet": serp.get("snippet", ""),
                "date": serp.get("date", ""),
                "favicon": favicon,
                "headings": headings[:80],
                "heading_count": len(headings),
                "word_count": word_count_val,
            })
        except Exception as e:
            print(f"[serp_analyzer] Failed to extract outline from {url}: {e}")

    return results

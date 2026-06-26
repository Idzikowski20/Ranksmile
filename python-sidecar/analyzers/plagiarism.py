"""Plagiarism checker — exact-phrase web search via serper.dev.

We pull representative sentences from the article, query each as an exact
quoted phrase, and treat any external page returned for that phrase as a
verbatim match. Uniqueness = share of sentences with no external match.
"""
import os
import re
import asyncio
import httpx

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")
_HTML_TAG = re.compile(r"<[^>]+>")
_WS = re.compile(r"\s+")


def extract_sentences(text: str, max_sentences: int = 12, min_words: int = 8, max_words: int = 40) -> list[str]:
    """Strip markup and sample evenly-spaced, substantial sentences."""
    clean = _WS.sub(" ", _HTML_TAG.sub(" ", text or "")).strip()
    candidates: list[str] = []
    for raw in _SENTENCE_SPLIT.split(clean):
        s = raw.strip()
        wc = len(s.split())
        if min_words <= wc <= max_words:
            candidates.append(s)
    if len(candidates) <= max_sentences:
        return candidates
    step = len(candidates) / max_sentences
    return [candidates[int(i * step)] for i in range(max_sentences)]


def _quoted_query(sentence: str, max_words: int = 16) -> str:
    phrase = " ".join(sentence.split()[:max_words]).replace('"', "")
    return f'"{phrase}"'


def _domain_of(url: str) -> str:
    return re.sub(r"^https?://", "", url or "").split("/")[0].replace("www.", "").lower()


async def _search(client: httpx.AsyncClient, phrase: str, api_key: str, lang: str) -> list[dict]:
    try:
        r = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
            json={"q": phrase, "hl": lang, "gl": lang, "num": 5},
        )
        r.raise_for_status()
        return r.json().get("organic", [])[:5]
    except Exception as exc:  # noqa: BLE001
        print(f"[plagiarism] serper error: {exc}")
        return []


async def run_plagiarism(text: str, own_domain: str = "", lang: str = "pl") -> dict:
    api_key = os.getenv("SERPER_API_KEY", "")
    sentences = extract_sentences(text)
    if not sentences:
        return {"available": True, "checked": 0, "matched": 0, "uniqueness": 100, "matches": []}
    if not api_key:
        return {"available": False, "error": "SERPER_API_KEY not configured"}

    own = (own_domain or "").replace("www.", "").lower()
    semaphore = asyncio.Semaphore(4)

    async with httpx.AsyncClient(timeout=20) as client:
        async def check(sentence: str):
            async with semaphore:
                organic = await _search(client, _quoted_query(sentence), api_key, lang)
                hits = []
                for item in organic:
                    url = item.get("link", "")
                    dom = _domain_of(url)
                    if not dom or (own and dom == own):
                        continue
                    hits.append({"url": url, "title": item.get("title", ""), "domain": dom})
                return sentence, hits

        results = await asyncio.gather(*[check(s) for s in sentences])

    matches = []
    for sentence, hits in results:
        if hits:
            top = hits[0]
            matches.append({
                "text": sentence,
                "url": top["url"],
                "title": top["title"],
                "domain": top["domain"],
                "sources": len(hits),
            })

    checked = len(sentences)
    matched = len(matches)
    uniqueness = round((checked - matched) / checked * 100) if checked else 100
    return {"available": True, "checked": checked, "matched": matched, "uniqueness": uniqueness, "matches": matches}

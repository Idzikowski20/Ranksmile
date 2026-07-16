"""
Semantic term extraction via DeepSeek API.
Replaces TF-IDF _extract_nlp_terms() with semantic extraction.
Chunks competitor pages by headings, caches per (keyword, chunk_hash),
extracts with concurrency-limited parallelism (asyncio.Semaphore(5)).
"""
import asyncio
import hashlib
import json
import re
from collections import defaultdict

import httpx
from bs4 import BeautifulSoup

from analyzers.competitor_terms import extract_nlp_terms, is_useful_phrase


_cache: dict[str, list[dict]] = {}
MAX_CACHE = 500
SEMAPHORE = asyncio.Semaphore(5)


def _cache_key(keyword: str, chunk_hash: str) -> str:
    return f"{keyword}::{chunk_hash}"


def _chunk_hash(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:12]


def _append_chunk(
    chunks: list[tuple[str, str]],
    seen_hashes: set[str],
    chunk_text: str,
    min_len: int,
) -> None:
    if len(chunk_text) <= min_len:
        return
    ch = _chunk_hash(chunk_text)
    if ch in seen_hashes:
        return
    chunks.append((chunk_text[:3000], ch))
    seen_hashes.add(ch)


def _build_chunks(texts: list[str]) -> list[tuple[str, str]]:
    """Split competitor HTML into heading chunks; plain SERP snippets become whole-text chunks.

    BeautifulSoup only finds h1–h4/p/li on real HTML. Title+snippet fallbacks are plain
    strings — without this path DeepSeek never runs and we only get keyword seeds.
    """
    chunks: list[tuple[str, str]] = []
    seen_hashes: set[str] = set()

    for text in texts:
        if not text or not text.strip():
            continue
        soup = BeautifulSoup(f"<div>{text}</div>", "lxml")
        structural = soup.find_all(["h1", "h2", "h3", "h4", "p", "li"])
        if not structural:
            plain = soup.get_text(" ", strip=True) or text.strip()
            _append_chunk(chunks, seen_hashes, plain, min_len=40)
            continue

        current_chunk: list[str] = []
        for tag in structural:
            t = tag.get_text(strip=True)
            if not t:
                continue
            if tag.name.startswith("h"):
                if current_chunk:
                    _append_chunk(chunks, seen_hashes, " ".join(current_chunk), min_len=100)
                    current_chunk = []
            current_chunk.append(t)
        if current_chunk:
            _append_chunk(chunks, seen_hashes, " ".join(current_chunk), min_len=100)

    return chunks


async def extract_semantic_terms(keyword: str, texts: list[str], deepseek_key: str) -> list[dict]:
    """
    Extract semantic terms from competitor page texts using DeepSeek.
    Chunks each text by headings, caches per chunk, aggregates results.
    Returns top 50 terms as [{term, target_count, type}].
    """
    if not texts:
        return _fallback_terms(texts, keyword)

    if not deepseek_key:
        return _fallback_terms(texts, keyword)

    # 1. Chunk texts by headings (or whole plain snippets)
    chunks = _build_chunks(texts)
    if not chunks:
        return _fallback_terms(texts, keyword)

    # 2. Cache hits vs misses
    uncached: list[tuple[str, str]] = []
    all_terms: list[dict] = []

    for chunk_text, ch in chunks:
        key = _cache_key(keyword, ch)
        if key in _cache:
            all_terms.extend(_cache[key])
        else:
            uncached.append((chunk_text, ch))

    # 3. Extract from uncached chunks (concurrency-limited)
    if uncached:
        async def _extract_one(chunk_text: str, ch: str):
            async with SEMAPHORE:
                return await _extract_chunk(keyword, chunk_text, ch, deepseek_key)

        results = await asyncio.gather(*(_extract_one(ct, ch) for ct, ch in uncached))
        for terms in results:
            all_terms.extend(terms)

    if not all_terms:
        return _fallback_terms(texts, keyword)

    # 4. Aggregate: doc_freq, avg relevance, dominant type
    term_groups: dict[str, dict] = {}
    for t in all_terms:
        name = t["term"].lower().strip()
        if name not in term_groups:
            term_groups[name] = {"relevances": [], "types": [], "occurrences": []}
        term_groups[name]["relevances"].append(t.get("relevance", 0.5))
        term_groups[name]["types"].append(t.get("type", "supporting"))
        if "occurrence_count" in t:
            term_groups[name]["occurrences"].append(t["occurrence_count"])

    n_docs = max(1, len(texts))
    lower_texts = [t.lower() for t in texts]
    aggregated = []
    stopwords = {"article", "information", "website", "site", "page", "web", "blog", "post",
                 "oraz", "jest", "czy", "jak", "lub", "warto", "wielu", "informacji"}
    for term, group in term_groups.items():
        if term in stopwords or keyword.lower() in term:
            continue
        if not is_useful_phrase(term):
            continue
        doc_freq = len(group["relevances"])
        avg_relevance = sum(group["relevances"]) / len(group["relevances"])
        type_counts = defaultdict(int)
        for tp in group["types"]:
            type_counts[tp] += 1
        dominant_type = max(type_counts, key=type_counts.get)

        if group["occurrences"]:
            target_count = max(1, round(sum(group["occurrences"]) / len(group["occurrences"])))
        else:
            target_count = max(1, round(doc_freq * avg_relevance * 3))

        # Suggested range = spread of real per-competitor occurrence counts (SurferSEO
        # shows e.g. "1-4"): min/max across the pages that actually use the term.
        per_doc = [lt.count(term) for lt in lower_texts]
        nonzero = [c for c in per_doc if c > 0]
        s_min = max(1, min(nonzero)) if nonzero else 1
        s_max = max(nonzero) if nonzero else target_count

        aggregated.append({
            "term": term,
            "target_count": target_count,
            "type": dominant_type,
            "doc_freq": doc_freq,
            "relevance": round(avg_relevance, 2),
            "suggested_min": s_min,
            "suggested_max": s_max,
        })

    # 5. Filter: >=30% of docs (min 2)
    min_docs = max(1, round(0.3 * n_docs)) if n_docs <= 3 else max(2, round(0.3 * n_docs))
    aggregated = [t for t in aggregated if t["doc_freq"] >= min_docs]

    if not aggregated:
        return _fallback_terms(texts, keyword)

    aggregated.sort(key=lambda t: (t["doc_freq"] * t["relevance"]), reverse=True)

    return [
        {
            "term": t["term"], "target_count": t["target_count"], "type": t["type"],
            "relevance": t["relevance"], "doc_freq": t["doc_freq"],
            "suggested_min": t["suggested_min"], "suggested_max": t["suggested_max"],
        }
        for t in aggregated[:120]
    ]


async def _extract_chunk(keyword: str, chunk_text: str, chunk_hash: str, api_key: str) -> list[dict]:
    """Extract terms from one chunk via DeepSeek. Results are cached."""
    prompt = f"""You are an SEO analyzer. Given text from a top-ranking page for the keyword
"{keyword}", extract distinctive SEO-relevant terms and phrases (1-4 words)
that characterize what makes this content rank well.

Return ONLY: [{{"term": "phrase here", "relevance": 0.95, "type": "type"}}, ...]

Rules:
- relevance = how strongly this term defines the topic (0.0-1.0)
- type = "core" (primary topic), "supporting" (secondary), "entity" (named entity), or "question" (implicit question)
- Include multi-word phrases (e.g., "keyword research tools")
- Skip generic terms ("article", "information", "website")
- Skip the keyword itself if it appears
- Return 10-20 terms max

TEXT:
{chunk_text}"""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
                json={
                    "model": "deepseek-chat",
                    "max_tokens": 1024,
                    "temperature": 0.1,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            raw: str = data["choices"][0]["message"]["content"]

        json_match = re.search(r"\[[\s\S]*\]", raw)
        if not json_match:
            return []

        terms = json.loads(json_match[0])
        if isinstance(terms, list):
            key = _cache_key(keyword, chunk_hash)
            _cache[key] = terms
            if len(_cache) > MAX_CACHE:
                oldest = next(iter(_cache))
                del _cache[oldest]
            return terms

        return []
    except Exception as exc:
        print(f"[semantic_terms] chunk extraction failed: {exc}")
        return []


def _fallback_terms(texts: list[str], keyword: str) -> list[dict]:
    """TF-IDF phrase extraction when DeepSeek is unavailable — Surfer-style n-grams."""
    if not texts:
        return [{"term": keyword, "target_count": 3, "type": "core"}] if keyword else []

    tfidf_terms = extract_nlp_terms(texts, keyword)
    if tfidf_terms:
        return [
            {
                "term": t["term"], "target_count": t["target_count"], "type": "supporting",
                "relevance": 0.6, "doc_freq": t.get("doc_freq", 1),
                "suggested_min": max(1, t["target_count"] - 1),
                "suggested_max": max(t["target_count"], t["target_count"] + 2),
            }
            for t in tfidf_terms[:80]
        ]

    return [{"term": keyword, "target_count": 3, "type": "core"}] if keyword else []

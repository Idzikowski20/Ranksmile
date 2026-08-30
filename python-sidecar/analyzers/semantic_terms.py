"""
Semantic term extraction via DeepSeek API.
Replaces TF-IDF _extract_nlp_terms() with semantic extraction.
Chunks competitor pages by headings, caches per (keyword, chunk_hash),
extracts with concurrency-limited parallelism (asyncio.Semaphore(5)).
"""
import asyncio
import os
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


async def extract_semantic_terms(keyword: str, texts: list[str], deepseek_key: str, language: str = "pl") -> list[dict]:
    """
    Extract semantic terms from competitor page texts using DeepSeek.
    Chunks each text by headings, caches per chunk, aggregates results.
    Returns top 50 terms as [{term, target_count, type}].
    """
    if not texts:
        return _fallback_terms(texts, keyword, language)

    if not deepseek_key and not (os.getenv("OPENROUTER_API_KEY") or "").strip():
        return _fallback_terms(texts, keyword, language)

    # 1. Chunk texts by headings (or whole plain snippets)
    chunks = _build_chunks(texts)
    if not chunks:
        return _fallback_terms(texts, keyword, language)

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
        return _fallback_terms(texts, keyword, language)

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
        # How many CHUNKS produced the term. Chunks are per-heading, so one page can
        # contribute several — this is not a document frequency and must never be sent
        # out as one (consumers gate topicality on "more than one page used it").
        chunk_hits = len(group["relevances"])
        avg_relevance = sum(group["relevances"]) / len(group["relevances"])
        type_counts = defaultdict(int)
        for tp in group["types"]:
            type_counts[tp] += 1
        dominant_type = max(type_counts, key=type_counts.get)

        if group["occurrences"]:
            target_count = max(1, round(sum(group["occurrences"]) / len(group["occurrences"])))
        else:
            target_count = max(1, round(chunk_hits * avg_relevance * 3))

        # Suggested range from how densely the ranking pages actually use the term.
        #
        # This was `lt.count(term)`, a raw substring count with no word boundary, and the
        # min/max of the result became the range the article is graded against. "emocjonalne"
        # matches inside "emocjonalnego" and "emocjonalnej", so it scored 37 hits on the
        # thinnest page and 91 on the heaviest — and article 84 was told to use one adjective
        # between 37 and 91 times. Counting whole words fixes the inflation; scaling by
        # document length fixes the rest, because an absolute count taken from a 6000-word
        # competitor does not transfer to a 2000-word brief.
        per_doc = [_count_whole_word(lt, term) for lt in lower_texts]
        nonzero = [c for c in per_doc if c > 0]
        if nonzero:
            densities = sorted(
                c / max(1, len(lt.split()))
                for c, lt in zip(per_doc, lower_texts) if c > 0
            )
            median_density = densities[len(densities) // 2]
            typical_words = sum(len(lt.split()) for lt in lower_texts) / len(lower_texts)
            expected = median_density * typical_words
            s_min = max(1, round(expected * 0.6))
            # The ceiling scales with document length instead of a flat 15: Surfer's own
            # guideline for this keyword allows "szantaż: 44-87" against ~2500 words
            # (~3.5% density), and a flat cap flattened exactly the core terms. The
            # density model already tames a stray high-frequency page via the median.
            density_cap = max(15, round(typical_words * 0.035))
            s_max = min(density_cap, max(s_min + 1, round(expected * 1.4)))
        else:
            s_min = 1
            s_max = max(1, target_count)

        aggregated.append({
            "term": term,
            "target_count": target_count,
            "type": dominant_type,
            # Distinct pages using the term — same primitive competitor_terms.py counts.
            "doc_freq": len(nonzero),
            "chunk_hits": chunk_hits,
            "relevance": round(avg_relevance, 2),
            "suggested_min": s_min,
            "suggested_max": s_max,
        })

    # 5. Filter by chunk-hit frequency. Short SERP-snippet corpora produce few chunks —
    # require only 1 hit so DeepSeek phrases aren't discarded before TF-IDF fallback.
    min_docs = 1 if n_docs <= 6 else max(2, round(0.3 * n_docs))
    aggregated = [t for t in aggregated if t["chunk_hits"] >= min_docs]

    # Not just "empty": a thin harvest is the same failure with a softer face. Individual
    # chunk calls fail silently (empty completion, timeout, a provider hiccup), so the same
    # 6-competitor cohort produced 132 terms one run and 13 the next — and 13 terms means a
    # weak guideline, a weak score and almost no internal-link targets. Below the floor the
    # deterministic entity/TF-IDF terms top the list up.
    MIN_TERMS = 25
    if len(aggregated) < MIN_TERMS:
        print(f"[semantic_terms] thin LLM harvest ({len(aggregated)}) — topping up from the deterministic path")
        fallback = _fallback_terms(texts, keyword, language)
        have = {t["term"].lower() for t in aggregated}
        for t in fallback:
            if t["term"].lower() in have:
                continue
            aggregated.append({**t, "chunk_hits": 1, "relevance": t.get("relevance", 0.6)})
            have.add(t["term"].lower())
            if len(aggregated) >= 60:
                break

    if not aggregated:
        return _fallback_terms(texts, keyword, language)

    aggregated.sort(key=lambda t: (t["chunk_hits"] * t["relevance"]), reverse=True)

    semantic = [
        {
            "term": t["term"], "target_count": t["target_count"], "type": t["type"],
            "relevance": t["relevance"], "doc_freq": t["doc_freq"],
            "suggested_min": t["suggested_min"], "suggested_max": t["suggested_max"],
        }
        for t in aggregated[:120]
    ]
    return _merge_nlp_terms(semantic, texts, keyword)


# The reference tool ships two term sets side by side — a curated ~80 it asks you to
# include, and a ~290-strong NLP set — and grades against the union.
MAX_TERMS = 150


def _merge_nlp_terms(semantic: list[dict], texts: list[str], keyword: str) -> list[dict]:
    """Union the LLM's terms with the TF-IDF n-grams instead of choosing between them.

    TF-IDF used to run only when DeepSeek returned nothing, so on every healthy run the
    whole n-gram set was thrown away. What survived was the LLM list after the chunk-hit
    filter — 15 terms for a 9-competitor SERP where the reference tool listed 81. A term
    the model never named is still a term the article is graded on, so the two sets
    belong together; the model's entry wins on conflict because it carries a type and a
    relevance the n-gram path cannot produce.
    """
    seen = {t["term"] for t in semantic}
    extra = [t for t in _fallback_terms(texts, keyword) if t["term"] not in seen]
    seen.update(t["term"] for t in extra)
    # Collocations third: the natural word-pairs ranking pages repeat ("poczucia winy",
    # "wlasnych granic") are the bulk of Surfer's own term list, and neither the LLM
    # entity path nor TF-IDF surfaces them.
    from analyzers.competitor_terms import extract_collocations
    collocations = [t for t in extract_collocations(texts) if t["term"] not in seen]
    return (semantic + extra + collocations)[:MAX_TERMS]


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
            from analyzers.llm_chat import chat_config, chat_headers, chat_payload
            cfg = chat_config() or {
                "url": "https://api.deepseek.com/v1/chat/completions",
                "key": api_key, "model": "deepseek-chat", "extra": {},
            }
            resp = await client.post(
                cfg["url"],
                headers=chat_headers(cfg),
                json=chat_payload(cfg, [{"role": "user", "content": prompt}], 1024),
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


def _entity_terms(texts: list[str], language: str) -> list[dict]:
    """NER entities across the cohort — relationship-bearing phrases, not TF-IDF shingles.

    spaCy when the model is installed, regex capitalized-span fallback otherwise. Only
    entities at least two pages mention survive: a name one page drops is that page's
    business, not the topic's vocabulary."""
    from analyzers.ner import extract_entities
    from analyzers.competitor_terms import is_useful_phrase

    docs_with: dict[str, int] = {}
    occurrences: dict[str, int] = {}
    display: dict[str, str] = {}
    for text in texts:
        spans = extract_entities(text, language=language, max_spans=60).get("spans", [])
        seen_here: set[str] = set()
        lower = text.lower()
        for span in spans:
            raw = (span.get("text") or "").strip()
            key = raw.lower()
            if len(key) < 4 or len(key) > 60 or not is_useful_phrase(key):
                continue
            display.setdefault(key, raw)
            if key not in seen_here:
                docs_with[key] = docs_with.get(key, 0) + 1
                occurrences[key] = occurrences.get(key, 0) + max(1, lower.count(key))
                seen_here.add(key)
    n_docs = max(1, len(texts))
    out = []
    for key, df in sorted(docs_with.items(), key=lambda kv: (-kv[1], kv[0])):
        if df < 2 and n_docs >= 3:
            continue
        avg = max(1, round(occurrences[key] / df))
        out.append({
            "term": display[key], "target_count": min(avg, 5), "type": "entity",
            "relevance": 0.7, "doc_freq": df,
            "suggested_min": 1, "suggested_max": min(avg + 1, 6),
        })
    return out[:40]


def _count_whole_word(text: str, term: str) -> int:
    """Occurrences of `term` as a whole word/phrase — not as a substring of a longer form."""
    return len(re.findall(rf"(?<!\w){re.escape(term)}(?!\w)", text))


def _fallback_terms(texts: list[str], keyword: str, language: str = "pl") -> list[dict]:
    """TF-IDF phrase extraction when DeepSeek is unavailable — Ranksmile-style n-grams.

    `doc_freq` passes straight through and means the same thing on both paths: the number
    of distinct pages containing the term (`extract_nlp_terms` counts `docs_with_term`,
    the DeepSeek path above counts pages with a non-zero occurrence). The one exception is
    the keyword row TF-IDF seeds, which reports `n_docs` by assumption rather than by
    counting — consumers gating on "more than one page" read it as a floor there.
    """
    if not texts:
        return [{"term": keyword, "target_count": 3, "type": "core"}] if keyword else []

    # Entities lead, n-grams fill: a Surfer-style guideline is built from entities and
    # their co-occurrence, and pure TF-IDF was the step where quality fell off a cliff
    # whenever the LLM extractor was unavailable.
    entity_terms = _entity_terms(texts, language)
    tfidf_terms = extract_nlp_terms(texts, keyword)
    if entity_terms:
        seen = {t["term"].lower() for t in entity_terms}
        for t in tfidf_terms:
            if len(entity_terms) >= 50:
                break
            if t["term"].lower() in seen:
                continue
            entity_terms.append({
                "term": t["term"], "target_count": t["target_count"], "type": "supporting",
                "relevance": 0.6, "doc_freq": t.get("doc_freq", 1),
                "suggested_min": max(1, t["target_count"] - 1),
                "suggested_max": max(t["target_count"], t["target_count"] + 2),
            })
            seen.add(t["term"].lower())
        return entity_terms
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

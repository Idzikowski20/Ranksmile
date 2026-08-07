"""doc_freq must count PAGES, not chunks.

Chunks are per-heading, so one page contributes several. Emitting the chunk count as
`doc_freq` let a phrase used twice inside a single page look like corpus-wide evidence —
which is exactly the licence downstream filters use to skip their topic check.
"""
import asyncio

from analyzers import semantic_terms
from analyzers.semantic_terms import _build_chunks, _cache_key, extract_semantic_terms


TERM = "wykrywanie podsluchow"
FILLER = "Opisujemy tutaj szczegolowo cala procedure oraz jej kolejne etapy w praktyce zawodowej. "

# One page, two heading sections, both mentioning the term. A second page never uses it.
PAGE_WITH_TERM = (
    f"<h2>Zakres</h2><p>{FILLER}{TERM} w biurze klienta {FILLER}</p>"
    f"<h2>Cennik</h2><p>{FILLER}{TERM} na zlecenie {FILLER}</p>"
)
PAGE_WITHOUT_TERM = f"<h2>Kontakt</h2><p>{FILLER}{FILLER}</p>"
KEYWORD = "prywatny detektyw warszawa"


def test_doc_freq_counts_documents_not_chunks():
    texts = [PAGE_WITH_TERM, PAGE_WITHOUT_TERM]
    chunks = _build_chunks(texts)
    assert len([c for c in chunks if TERM in c[0]]) == 2, "need two chunks from one page"

    semantic_terms._cache.clear()
    for chunk_text, chunk_hash in chunks:
        semantic_terms._cache[_cache_key(KEYWORD, chunk_hash)] = (
            [{"term": TERM, "relevance": 0.9, "type": "core"}] if TERM in chunk_text else []
        )

    try:
        terms = asyncio.run(extract_semantic_terms(KEYWORD, texts, "test-key-unused"))
    finally:
        semantic_terms._cache.clear()

    row = next(t for t in terms if t["term"] == TERM)
    assert row["doc_freq"] == 1, f"one page used it, got doc_freq={row['doc_freq']}"

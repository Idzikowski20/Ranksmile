# Phase B: Polish display ≠ match + sacred import keyword

**Date:** 2026-07-16  
**Status:** Approved (user chose approach 2 + implement)  
**Sequence:** B → A (AI Search multi-engine) → C (Surfy live highlight)

## Problem

1. Terms show broken Polish: `dzia ania`, `przyk ady` (ł removed → space).
2. User import keyword `wojna hybrydowa` can become `wojna hybry` in Keywords / AI prompts / FAQ.
3. Root causes:
   - `normalizeTerm()` strips `ł` (does not NFD-decompose; `[^a-z0-9]` → space). `PL_DIACRITICS` map exists but is unused.
   - `filterUsefulNlpTerms` / `dedupeUsefulTerms` **overwrite** display `term` with `normalizeTerm(...)`.
   - Deep analysis may `UPDATE articles SET target_keyword = resolvedKeyword` after discovery, replacing the user’s import seed.

## Goals

- UI and persisted NLP terms keep real Polish orthography (`działania`, `przykłady`).
- ASCII-fold only for matching, dedupe keys, and topic filters.
- User-provided main keyword at import is never overwritten by discovery.
- Python sidecar TF-IDF normalization maps `ł`→`l` the same way (corpus matching), without emitting display strings that dropped `ł` into spaces.

## Non-goals (later phases)

- AI Search multi-engine fan-out (~10 topics × 5 questions) — Phase A
- Surfy live orange highlight + Sentry buttons — Phase C
- Fixing Vercel `render-page` 500 / Wikipedia scrape blocks (helps term volume, separate)

## Design

### 1. `normalizeTerm` (match key)

Order of operations:

1. Lowercase
2. Map `ąćęłńóśźż` → ASCII via `PL_DIACRITICS` (same as `termMatch.normalizePl`)
3. NFD + strip combining marks (safety for other languages)
4. Replace remaining non `[a-z0-9\s-]` with space
5. Collapse whitespace

`działania` → match key `dzialania` (not `dzia ania`).

### 2. Display ≠ match

| Function | Today | After |
|----------|-------|-------|
| `filterUsefulNlpTerms` | `term: normalizeTerm(t.term)` | keep original `term`; dedupe on `normalizeTerm` key |
| `dedupeUsefulTerms` | pushes `term: key` | keep original `term`; dedupe on key |
| Topic filters | OK (normalize for compare only) | unchanged pattern |

Prefer the best display form when colliding keys (prefer string that still contains Polish diacritics / longer original).

### 3. Sacred import keyword

In `deep-analysis.ts` (and any similar path):

- If `pipelineKeywords[0]` / user seed is non-empty, **do not** `UPDATE target_keyword` from discovery.
- Discovery may still `saveArticleKeywords` for secondary keywords.
- Log when discovery would have changed the keyword (debug).

`resolveAnalysisSeedKeyword` already prefers user — the bug is the unconditional UPDATE after discovery.

### 4. Sidecar

Align `competitor_terms.normalize_text` with ł→l mapping before stripping non-ASCII, so TF-IDF tokens are `dzialania` not split tokens.

Display terms returned to Node should prefer original casing/orthography from extraction when available; if TF-IDF only has folded forms, Node must not re-break them via bad normalize.

### 5. Tests

- `normalizeTerm('działania poniżej progu wojny')` → `dzialania ponizej progu wojny`
- `filterUsefulNlpTerms([{ term: 'działania hybrydowe', ... }])[0].term` === `działania hybrydowe`
- Unit/integration: deep-analysis keyword guard (extract helper if needed) — user seed wins

## Success criteria

- After re-run deep analysis on a PL article: terms list shows `ł`/`ą`/etc. correctly.
- Import keyword stays exactly as typed in Keywords tooltip / `target_keyword`.
- AI fallback prompts use full keyword (`wojna hybrydowa`), not `wojna hybry`.

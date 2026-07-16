# Phase B Polish display ≠ match — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Polish orthography in displayed/persisted terms and sacred import keywords; use ASCII-fold only for matching keys.

**Architecture:** Fix `normalizeTerm` mapping; stop overwriting `term` with folded forms in calibration/dedupe; guard `target_keyword` UPDATE in deep-analysis; mirror ł→l in Python TF-IDF normalize.

**Tech Stack:** TypeScript (Next.js), Jest, Python sidecar (pytest)

---

### Task 1: Fix `normalizeTerm` + tests

**Files:**
- Modify: `lib/termUtils.ts`
- Test: `__tests__/lib/termUtils.test.ts` (create if missing)

- [ ] Write failing tests for `ł` → `l` (not space) and display preservation helpers
- [ ] Implement PL_DIACRITICS before NFD strip in `normalizeTerm`
- [ ] Run Jest; confirm pass

### Task 2: Display ≠ match in term lists

**Files:**
- Modify: `lib/competitorTermCalibration.ts` (`filterUsefulNlpTerms`)
- Modify: `lib/termUtils.ts` (`dedupeUsefulTerms`)
- Test: `__tests__/lib/competitorTermCalibration.test.ts`

- [ ] Failing test: filtered terms keep `działania`
- [ ] Dedupe by normalize key; keep original display term (prefer diacritics)
- [ ] Run related Jest suites

### Task 3: Sacred import keyword guard

**Files:**
- Modify: `pages/api/articles/deep-analysis.ts`
- Optional extract: `lib/resolveAnalysisSeedKeyword` usage only — no UPDATE when user seed present
- Test: small unit test for guard helper if extracted

- [ ] When `pipelineKeywords[0]` set, skip `UPDATE target_keyword`
- [ ] Still allow `saveArticleKeywords` for discovery list
- [ ] Log skipped overwrite

### Task 4: Python sidecar normalize

**Files:**
- Modify: `python-sidecar/analyzers/competitor_terms.py`
- Test: `python-sidecar/tests/test_competitor_terms_normalize.py`

- [ ] Failing test: `normalize_text("działania")` → contains `dzialania` not `dzia ania`
- [ ] Implement map; run pytest

### Task 5: Verify + graphify

- [ ] Run Jest + pytest for touched files
- [ ] `graphify update .`
- [ ] Commit when user requests (or per brainstorming commit for docs already done)

---

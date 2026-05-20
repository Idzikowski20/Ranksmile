# Article Editor AI — Sub-project A1 Design Spec

**Date:** 2026-05-20
**Status:** Approved — ready for implementation

---

## Goal

Extend the auto-optimize pipeline into a single-button, three-phase AI flow: NLP optimization → DeepSeek humanizer → FAQ/PAA injection. Add Brand Voice per-domain so every AI prompt honours the publisher's tone. Add a "SERP Fit" gauge to ContentScorePanel that scores how well the article matches the top-ranking competitor structure.

---

## Section 1 — Auto-Optimize Pipeline Extension

### Overview

The current auto-optimize flow stops after NLP keyword optimization. We extend it with two sequential phases:

| Phase | What it does | Model / service |
|-------|-------------|-----------------|
| 1 — NLP Optimize | Inject missing keywords, fix density | DeepSeek (existing) |
| 2 — Humanize | Rewrite to remove AI markers, add variation | DeepSeek |
| 3 — FAQ / PAA | Append FAQ section sourced from Serper PAA + DeepSeek answers | Serper.dev + DeepSeek |

All three phases run inside a single HTTP SSE stream (existing endpoint `POST /api/articles/auto-optimize`). The frontend shows progress per-phase through existing SSE event infrastructure.

### SSE Event Protocol

New events added to the stream:

```
event: progress
data: {"step": "humanizing", "message": "Humanizing content…"}

event: progress
data: {"step": "faq", "message": "Fetching People Also Ask…"}

event: done
data: {"content": "<full article HTML>", "pendingImages": [...]}
```

Existing `progress` and `done` handlers in the frontend already handle this; only the `message` field changes.

### Backend Changes (`pages/api/articles/auto-optimize.ts`)

1. After the NLP-optimized HTML is produced, pass it to a new `humanizeContent(html, brandVoice)` helper that calls DeepSeek.
2. After humanizing, call `fetchFaqSection(keyword, brandVoice)` which:
   a. Hits Serper `/search` with `type: "search"` to get PAA questions (up to 5).
   b. Calls DeepSeek to write concise answers for each question, styled with Brand Voice.
   c. Returns an `<h2>FAQ</h2><div class="faq">…</div>` HTML block.
3. Append the FAQ block to the end of the humanized HTML.
4. Send `done` with the final HTML.

### Frontend Changes (`pages/articles/[id]/index.tsx`)

- Progress bar messages update per SSE `progress` event (already rendered via `autoOptimizeBar.message` or equivalent).
- No new UI elements required — existing accept/retry/discard bar handles all three phases.

### Brand Voice Injection (see Section 2)

`brandVoice` string is passed from frontend → API body → all DeepSeek system prompts in all three phases.

---

## Section 2 — Brand Voice per Domain

### Data Model

**Migration (Umzug):** add `brand_voice TEXT NOT NULL DEFAULT ''` column to the `domains` table.

```sql
ALTER TABLE domains ADD COLUMN brand_voice TEXT NOT NULL DEFAULT '';
```

Migration file: `python-sidecar/migrations/YYYYMMDD_add_brand_voice.py` (Umzug pattern matching existing migrations).

### Domain Settings UI

Location: Domain settings modal / page (existing).

Add a labelled `<textarea>` below the existing domain fields:

```
Label: "Brand Voice"
Placeholder: "Describe your writing style, tone, audience, and any rules the AI should follow…"
Rows: 4
Max characters: 2000 (shown as counter)
```

Saved via existing domain PATCH/PUT API endpoint.

### API Pass-through

`POST /api/articles/auto-optimize` body gains optional field `brandVoice: string`.

The frontend reads `domain.brand_voice` from the already-loaded domain object and includes it in the request body.

Inside `auto-optimize.ts`, `brandVoice` is appended to every DeepSeek system prompt:

```
If the brand_voice string is non-empty, append to system prompt:
"\n\nBrand Voice Guidelines:\n{brandVoice}"
```

This applies to: NLP optimization prompt, humanizer prompt, FAQ answer prompt.

---

## Section 3 — SERP Fit Score

### What it measures

How well the article's structure matches the top-ranking competitor articles already scraped into `competitor_outlines_cache`.

### Algorithm (0–100)

| Component | Weight | Method |
|-----------|--------|--------|
| Heading Jaccard | 40% | Jaccard similarity on normalised H2/H3 sets |
| NLP Term Overlap | 40% | Fraction of competitor NLP terms present in article |
| Length Fit | 20% | `1 - abs(articleWords - avgCompetitorWords) / avgCompetitorWords`, clamped 0–1 |

**Heading Jaccard:**
- Normalise each heading: lowercase, strip punctuation, split to word-set.
- For each competitor outline, compute Jaccard(article headings, competitor headings).
- Average across all competitors.

**NLP Term Overlap:**
- Flatten all `nlpTerms` arrays from `competitor_outlines_cache` into a set of unique terms.
- Count how many appear in the article HTML (case-insensitive substring match).
- Score = matched / total, capped at 1.

**Length Fit:**
- `articleWords` = word count of article body text (strip tags).
- `avgCompetitorWords` = mean of competitor word counts (from cache).
- Score = max(0, 1 − |articleWords − avgCompetitorWords| / avgCompetitorWords).

Final: `serpFit = round(0.4 × headingJaccard × 100 + 0.4 × nlpOverlap × 100 + 0.2 × lengthFit × 100)`

### Where it's computed

Computed client-side in `ContentScorePanel.tsx` (same file that renders the content score), so it reacts live to editor changes without extra API round-trips. Inputs from props: `article.competitor_outlines_cache` (parsed JSON) and the live editor HTML.

### UI — ContentScorePanel

Below the existing main score gauge, add a second smaller gauge labelled **"SERP Fit"**:

- Same visual style as main gauge (SVG arc, animated fill).
- Hidden entirely when `competitor_outlines_cache` is null / empty.
- Label: "SERP Fit" with a small info tooltip: "How closely your article's structure matches top-ranking competitors."
- Colour zones: 0–39 red, 40–69 yellow, 70–100 green (same thresholds as main score).

---

## Architecture Diagram

```
[User clicks "Auto-Optimize"]
        │
        ▼
POST /api/articles/auto-optimize
  body: { articleId, keyword, html, brandVoice }
        │
        ├─ SSE: progress "Optimizing keywords…"
        ├─ Phase 1: NLP optimize (DeepSeek)
        ├─ SSE: progress "Humanizing content…"
        ├─ Phase 2: Humanize (DeepSeek + brandVoice)
        ├─ SSE: progress "Fetching People Also Ask…"
        ├─ Phase 3a: Serper PAA fetch
        ├─ Phase 3b: FAQ answers (DeepSeek + brandVoice)
        └─ SSE: done { content, pendingImages }

[Frontend]
  ├─ Accept bar appears
  ├─ generatePendingImages() replaces __AIMG_N__ placeholders
  └─ ContentScorePanel recomputes SERP Fit live
```

---

## Files Touched

| File | Change |
|------|--------|
| `python-sidecar/migrations/YYYYMMDD_add_brand_voice.py` | New migration: add `brand_voice` column |
| `python-sidecar/db/domain_model.py` (or equivalent) | Expose `brand_voice` in domain read/write |
| `pages/api/domains/[id].ts` | Accept `brandVoice` in PATCH body |
| `pages/api/articles/auto-optimize.ts` | Add humanizer + FAQ phases; inject `brandVoice` |
| `pages/articles/[id]/index.tsx` | Pass `brandVoice` in auto-optimize fetch body |
| `components/domains/DomainSettings.tsx` (or modal) | Add Brand Voice textarea |
| `components/articles/ContentScorePanel.tsx` | Add SERP Fit gauge below main gauge |

---

## Out of Scope (A2+)

- Competitor mini-gauge in ResearchOutlinePanel
- Schema generator
- Content Brief panel
- Plagiarism checker
- Internal link map
- Content Freshness indicator
- AI Visibility Tracker (Sub-project E)

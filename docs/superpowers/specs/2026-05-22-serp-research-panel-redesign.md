# SERP Research Panel — Redesign Spec
**Date:** 2026-05-22  
**Scope:** `ResearchOutlinePanel.tsx`, `deep-analysis.ts`, `generate-outline.ts`, `ArticleEditor.tsx`, `python-sidecar/main.py`

---

## Problem

1. **Competitor data loads on-demand** — opening the Research panel fires a full Serper API call + scrape of 5 competitor pages. The first open always waits 15–30s. Cache only warms after that first visit.
2. **Per-competitor "Insert Outline" + "Copy" buttons** invite copying competitor structure rather than synthesising something better.
3. **Panel name "Research & Create Outline"** and button "Generate Outline" don't communicate the real goal: study top competitors → create a superior article.
4. **Generated outline has no context about the current article** — no way to see which sections are already covered vs. missing.
5. **"Questions" tab is an empty placeholder** — PAA questions are already fetched during deep analysis and go unused.
6. **Featured image hover panel missing** — in-content images have a full toolbar (AI generate, Pixabay, Upload, Regenerate, Delete) on hover. The featured image block is read-only with no interactions.
7. **`onFeaturedImageChange` callback bug** — the prop exists on `ArticleEditor` but is never called when `setFeaturedImage` changes; the parent never learns about featured image edits.

---

## Goals

- Panel opens instantly (or near-instantly) because data is pre-fetched during deep analysis
- Competitor cards are reference-only (no copy/paste shortcuts)
- Generated outline shows gap status vs. the current article (covered / expand / missing)
- Questions tab surfaces PAA questions with article coverage
- Featured image has the same hover toolbar as in-content images
- `onFeaturedImageChange` is correctly wired

---

## Changes

### 1. Cache competitors during deep analysis (`deep-analysis.ts`)

After Step 5 (SERP) completes, fire `/competitor-outlines` as a **background promise** (not awaited immediately). The promise runs in parallel with Steps 6–9. Before `res.end()`, await the promise and write the result to `competitor_outlines_cache` on the article.

```
Step 5: SERP done
        ↓  ← start competitorOutlinesPromise (background, non-blocking)
Step 6: Score
Step 7: Image upload          ← ~10–20s gives outlines time to finish
Step 8: Save
Step 9: AI Visibility
        ↓
await competitorOutlinesPromise
→ UPDATE articles SET competitor_outlines_cache = ? WHERE id = ?
done
```

The `/competitor-outlines` sidecar endpoint currently makes its own Serper call. We pass the keyword (same as SERP step). This is a duplicate Serper call but keeps the sidecar interface clean; optimising to reuse URLs is a future improvement.

**Failure handling:** The background promise must be wrapped in try/catch. If `/competitor-outlines` fails or times out, log a warning (`console.warn('[deep-analysis] competitor outlines cache failed:', err.message)`) and continue — do NOT throw or abort the analysis. The panel will fall back to on-demand loading as before.

**Result:** `competitor_outlines_cache` is always populated by the time the user opens the editor. Panel opens instantly.

---

### 2. Rename (`ResearchOutlinePanel.tsx`)

| Before | After |
|---|---|
| Panel header: "Research & Create Outline" | **"SERP Research"** |
| Button (no article content): "Generate Outline" | **"Create Outline"** |
| Button (article has headings): "Generate Outline" | **"Analyze & Improve"** |
| Section: "AI-Generated Outline" | **"Generated Outline"** |

Context detection: `currentHeadings.length > 0` (new prop, see §4).

---

### 3. Remove per-competitor action buttons (`ResearchOutlinePanel.tsx`)

Remove from each expanded competitor card:
- "Insert outline" button
- "Copy" button (clipboard)

The expanded card still shows the heading structure as read-only reference. No other visual changes to the card.

---

### 4. New props on `ResearchOutlinePanel` (`ResearchOutlinePanel.tsx`)

```typescript
// Added to existing Props interface:
currentHeadings?: Array<{ level: number; text: string }>;  // from the editor
currentWordCount?: number;    // for SERP Insights word-count comparison
paaQuestions?: string[];      // from scoreData.paa_questions
```

These props are passed from **`pages/articles/[id]/index.tsx`** — this is where `ResearchOutlinePanel` is rendered (not inside `ArticleEditor`). The page already has access to `editorHeadings` state, article word count, and `scoreData.paa_questions` from the deep analysis result stored on the article.

---

### 5. SERP Insights section (`ResearchOutlinePanel.tsx`)

Add a compact section **above** "Competitors' Outlines", computed client-side from the `competitors` array (no extra API call):

```
SERP Insights
─────────────────────────────────────────────────
Avg. competitor   2,340 words  │  Your article  890 words
─────────────────────────────────────────────────
Common topics (3+ / 5 competitors):
[zarządzanie projektem]  [scrum vs kanban]  [narzędzia PM]  [+3 more]
```

**Avg word count:** mean of `competitor.word_count` across all competitors.

**Common topics:** Extract all significant words (length > 3) from every competitor's headings. Build a word-frequency map counting how many distinct competitors contain each word. Show words appearing in ≥3 competitors as pills (sorted by frequency, descending), max 6 visible + "+ N more". This surfaces recurring concepts across competitors (e.g., "zarządzanie", "scrum", "metodyki") rather than matching full heading strings.

---

### 6. Gap analysis on generated outline (`ResearchOutlinePanel.tsx` + `generate-outline.ts`)

**Client-side classification** — after AI returns `headings[]`, each heading is classified against `currentHeadings` using Jaccard similarity on words with length > 3:

| Overlap | Status | Color |
|---|---|---|
| ≥ 50% | `covered` | green dot + muted text |
| 20–49% | `expand` | yellow dot |
| < 20% | `missing` | red dot + bold text |

When article is empty (`currentHeadings.length === 0`), all headings show `missing` (normal behaviour for a new article — all sections still need writing).

**Prompt improvement in `generate-outline.ts`:** Add a `currentHeadings` param to the request body. Include current headings in the prompt so the AI knows what already exists and can specifically call out what's missing. The AI still generates a full outline (not a diff), but the instructions emphasise filling gaps.

---

### 7. Questions tab — PAA coverage (`ResearchOutlinePanel.tsx`)

Replace the "coming soon" placeholder with a PAA list from `paaQuestions` prop:

```
❓ Jakie są najlepsze metodyki zarządzania projektami?
   ✅ Covered — matches heading "Metodyki projektowe"

❓ Czym różni się Scrum od Kanbana?
   🔴 Not covered

❓ Jakie narzędzia PM są najlepsze w 2024?
   🔴 Not covered
```

Coverage check: same Jaccard function as §6 — check if any `currentHeadings` heading overlaps ≥ 50% with the question words.

If `paaQuestions` is empty or undefined: show "No PAA questions found — run deep analysis to fetch them."

---

### 8. Featured image hover panel (`ArticleEditor.tsx`)

`FeaturedImageBlock` currently accepts only `imageUrl` and `imageAlt`. Extend it to match the `SurferImageNode` hover experience.

**New props on `FeaturedImageBlock`:**

```typescript
onImageChange?: (img: { url: string; alt: string }) => void;
onImageRemove?: () => void;
keyword?: string;   // for AI generate default prompt
```

**Hover panel (inline styles — new code):**

On `mouseEnter` of the image container:
- Dark semi-transparent overlay (`rgba(0,0,0,0.45)`)
- Bottom toolbar slides up (same animation pattern as SurferImageNode):

```
┌─────────────────────────────────────────────────────────────────┐
│  [AI icon] [ Describe the image…              ] [Send →]        │
├─────────────────────────────────────────────────────────────────┤
│  ↺ Regenerate   🖼 Pixabay   ↑ Upload   drag & drop here   🗑  │
└─────────────────────────────────────────────────────────────────┘
```

**Actions:**
- **AI generate:** POST `/api/articles/generate-image` with prompt → `onImageChange({ url, alt })`
- **Regenerate:** same endpoint, uses `imageAlt` as prompt
- **Pixabay:** fires `surfer:open-pixabay` CustomEvent → `onImageChange`
- **Upload:** `<input type="file">` → `FileReader` → data URL → `onImageChange`
- **Remove:** calls `onImageRemove()`

**Alt text row** (below image, always visible when image exists): inline editable input, same style as SurferImageNode.

**Bug fix — `onFeaturedImageChange` never called:**  
In `ArticleEditor`, wrap `setFeaturedImage` calls in a helper:

```typescript
const updateFeaturedImage = (img: { url: string; alt: string } | null) => {
  setFeaturedImage(img);
  onFeaturedImageChange?.(img);
};
```

Use `updateFeaturedImage` everywhere `setFeaturedImage` is currently used.

Pass to `FeaturedImageBlock`:
```tsx
<FeaturedImageBlock
  imageUrl={featuredImage?.url}
  imageAlt={featuredImage?.alt}
  keyword={keyword}
  onImageChange={(img) => updateFeaturedImage(img)}
  onImageRemove={() => updateFeaturedImage(null)}
/>
```

---

## Files Changed

| File | Change |
|---|---|
| `pages/api/articles/deep-analysis.ts` | Fire `/competitor-outlines` in background after Step 5; await + cache before `done` |
| `pages/api/articles/generate-outline.ts` | Accept `currentHeadings` in request body; include in prompt |
| `components/articles/ResearchOutlinePanel.tsx` | Rename, remove per-comp buttons, SERP Insights, gap status, Questions tab, new props |
| `components/articles/ArticleEditor.tsx` | `FeaturedImageBlock` hover panel + `onFeaturedImageChange` bug fix |
| `python-sidecar/main.py` | No changes required (keyword-based `/competitor-outlines` endpoint stays as-is) |

## Out of Scope

- Sidecar URL deduplication (reusing SERP URLs instead of second Serper call) — future optimisation
- Full layout redesign of ResearchOutlinePanel — UI structure stays the same
- Pixabay modal implementation changes — reuse existing `surfer:open-pixabay` event system

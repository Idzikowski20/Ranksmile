# Planner + Auto-Optimize Wiring (Sub-project D) — Design

**Date:** 2026-07-01
**Status:** Draft v2 — tech-lead review incorporated (8 changes below). Ratified: Outline OUT of D; planner consumes `Guideline[]`; server-side context via `buildArticleContext`; deterministic, no new LLM call; stateless per run. Direction: `2026-06-30-coverage-engine-audit.md` §7 (primary blueprint) + C's non-goals list.
**Depends on:** A (Coverage Foundation, merged) + B (Shared Context, `buildArticleContext`) + C (Recommendation Engine, `buildGuidelines`/`groupGuidelines`, `lib/recommendationEngine.ts`). Reuses `Guideline` (C), `ArticleContext` (B), `CoverageSnapshot`/`CoverageItem` (A).
**Audit blueprint:** `docs/superpowers/specs/2026-06-30-coverage-engine-audit.md` §7 "Auto-Optimize (including Planner)" (lines 326–509).

## Goal

Insert the **Optimization Planner** — the "where + whether to act" layer between C's guideline *catalogue* and the Auto-Optimize LLM's "how". Today `pages/api/articles/optimize-sections.ts:100-101` builds ONE global system prompt from ONE input (missing NLP terms) and sends EVERY section through it unconditionally (`optimize-sections.ts:106` `for (const section of sections)`). D turns C's `Guideline[]` into a per-section **Plan** so each non-skipped section gets a targeted, cost-aware prompt, already-covered sections are skipped for free, guidelines are ROUTED to the sections they actually belong to (deterministic scoring, with an observable confidence + reason), lift is aggregated with diminishing returns, and the run is gated on ROI against the remaining token budget rather than a binary pool check.

`Coverage (A) "what is" → Recommendation Engine (C) "what to do" → Planner (D) "where + whether to act" → Auto-Optimize "how".`

**Defining constraint: the planner is DETERMINISTIC — NO new LLM call for planning.** It ROUTES C's already-computed `Guideline[]` + per-section deterministic signals (heading/body token overlap, per-section `countOccurrences`, `missingPoints`, `guideline.sectionId`) to sections via a scoring model. The LLM is still called once per non-skipped section for the actual edit, exactly as today (`optimize-sections.ts:113-126`). This mirrors C's own "NO new LLM call" constraint (`2026-06-30-recommendation-engine-design.md:14`).

## What D ships

1. `lib/optimizeGuidelineRouting.ts` — the pure `assignGuidelinesToSections(guidelines, sections)` helper (deterministic per-(guideline,section) SCORING model → highest-scoring section, with fallback, confidence, and reason). A swappable seam so a semantic matcher can drop in later behind the same signature.
2. `lib/optimizationPlanner.ts` — `buildOptimizationPlan(input): Plan` (PURE), the per-section `buildStepPrompt(step)` builder, `estimateStepTokens(section)`, the focus routing rules, diminishing-returns lift aggregation, `priority` sort, and the ROI budget trim.
3. The wiring in `pages/api/articles/optimize-sections.ts`: derive planner inputs SERVER-SIDE via `buildArticleContext(articleId)` + local `computeContentScoreBreakdown`, insert the planner at the `splitSections()`→loop seam (`:96`→`:106`), replace the single global `buildSystemPrompt(missingTerms)` (`:101`) with per-step `step.systemPrompt`, shift `recordAiTokens` to a per-step accumulator recorded in a `finally`, and surface `trimmed`/`ignoredLift` on a `meta`/`done` SSE event.

Untouched (reused UNCHANGED per audit §7 verdict, lines 505-507): the section loop dispatcher + retries + abort handling (`optimize-sections.ts:106-146`), SSE `meta`/`section`/`done` events (`lib/optimizeSectionEvents.ts`), the review-doc / Accept-Reject flow (`lib/optimizeReviewDoc.ts`, `components/articles/ContentOptimizerNodeView.tsx`), and the TipTap `contentOptimizer` atom (`components/articles/contentOptimizerNode.ts`). Frozen: `lib/aiCoverage.ts`, `lib/recommendationEngine.ts`, `lib/articleContext.ts`.

---

## Ratified decisions (baked in — no longer open)

1. **Outline is OUT of D.** The audit's §6 shows Outline is a distinct two-generator subsystem with its OWN LLM call (`generate-outline.ts:14-118` + `python-sidecar/pipeline/article_pipeline.py:108-122`). A new LLM call breaks D's deterministic spine, and Outline produces a brief for an article that may not exist yet (different input/output contract from routing guidelines to *existing* sections). **Outline becomes its own future sub-project — "Outline Engine (separate)".** It is ADDITIONAL to the roadmap's E (CoverageGraph / Fact-Authority); no letter is hard-assigned. Outline Engine may later reuse D's `assignGuidelinesToSections` heuristic for section-level brief directives.
2. **Planner consumes `Guideline[]`** (C's actionable shape, `recommendationEngine.ts:11-23`), NOT the audit's older `CoverageItem[]` sketch (audit line 440). D must NOT re-derive coverage.
3. **Server-side context.** The endpoint calls `buildArticleContext(articleId)` for planner inputs; the planner NEVER trusts client-sent coverage/keyword/brand data (security + DRY). `articleId` is already sent and access-checked (`optimize-sections.ts:56-60`).
4. **Planner stays DETERMINISTIC — no new LLM call. Cross-run section memory OUT of scope** (stateless per run — re-derives the plan from the current snapshot + current sections every invocation).

---

## Non-goals (deferred)

- **Outline generation** → separate "Outline Engine" sub-project (ratified decision 1). Requires a new LLM call.
- **Semantic/embedding section↔guideline matching** → later version behind the `assignGuidelinesToSections` seam. v1 is token-overlap scoring only.
- **Cross-run / persisted per-section memory** → out of scope; planner is stateless per run.
- **Per-section fractional credit charging** (the audit's "charge 5/8" idea, line 468) → v1 keeps the all-or-nothing `shouldChargeCredit(changedCount, aiTokens)` (`optimizeSectionEdit.ts:43-45`); D improves the *pre-run* gate (ROI-aware), not post-run charging.
- **Changes to `lib/aiCoverage`, `lib/recommendationEngine`, `lib/articleContext`** (frozen). No new DB columns — the plan is derived on read.
- **New LLM call for planning** — forbidden by construction.

---

## Type model (exact TS — put this verbatim in `lib/optimizationPlanner.ts`)

```ts
// lib/optimizationPlanner.ts
import type { Section } from './articleSections';
import type { Guideline } from './recommendationEngine';
import type { Importance } from './aiCoverage';
import type { ArticleContext } from './articleContext';
import type { computeContentScoreBreakdown } from './contentScore';

type ContentScoreBreakdown = ReturnType<typeof computeContentScoreBreakdown>;
// = { slots: Array<ScoreSlot & { missingPoints: number }>; totalPossible: number }

export type StepFocus =
  | 'seo-terms'     // weave under-target NLP terms (today's only behavior — kept, per-section weighted)
  | 'ai-coverage'   // answer-readiness / question coverage / entity-anchor sentences for cited prompts
  | 'readability'   // tighten / de-fluff / paragraph sizing
  | 'expand'        // deepen a shallow (needsExpansion) section
  | 'skip';         // already covered — no LLM, no tokens, emit changed:false directly

/** ONE guideline routed to ONE section, with the observability the review asked for. */
export interface RoutedGuideline {
  guideline: Guideline;
  confidence: number;   // [0,1] — normalized routing matchScore
  reason: string;       // why it landed here, e.g. "Matched entity React Hooks" / "Heading overlap 0.62"
  priority: number;     // importanceWeight(importance) * projectedLift * confidence — bullet/step order
}

/** What the planner decided to do with ONE section. */
export interface PlanStep {
  sectionId: string;                 // section.id (lib/articleSections.ts) — NOT a guideline id
  index: number;                     // section.index — preserves loop/SSE ordering
  headingText: string;
  html: string;                      // the section HTML the LLM edits (unchanged input)
  focus: StepFocus;
  systemPrompt: string;              // PER-SECTION (buildStepPrompt) — '' when focus==='skip'
  guidelines: RoutedGuideline[];     // routed to THIS section, sorted by priority desc (may be empty)
  missingTerms: string[];            // per-section under-target NLP terms (per-section countOccurrences)
  estimatedTokens: number;           // estimateStepTokens(section); 0 when focus==='skip'
  expectedLift: number;              // diminishing-returns aggregate of routed guidelines' projectedLift
  reason: string;                    // step-level: "Optimize: N guidelines" / "Skipped — no uncovered guidelines" / "Trimmed — budget"
}

export interface Plan {
  steps: PlanStep[];                 // one per section, in section order (skip steps included)
  estimatedTokens: number;           // Σ estimatedTokens over non-skip steps (post-trim)
  trimmed: boolean;                  // true when the ROI gate demoted ≥1 step to skip for budget
  ignoredLift: number;               // Σ expectedLift dropped by the ROI trim — "Skipped N potential points"
  rationale: string;                 // human-readable summary (surfaced in the SSE for observability)
}

export interface PlanInput {
  sections: Section[];                       // splitSections(content)  (articleSections.ts:30)
  guidelines: Guideline[];                   // C: buildGuidelines(snapshot, ctx)  (recommendationEngine.ts:155)
  breakdown: ContentScoreBreakdown;          // computed locally in the endpoint (ArticleContext.breakdown is null-typed)
  context: ArticleContext;                   // B: buildArticleContext(articleId)  (articleContext.ts:38)
  budgetRemaining: number;                   // usage.limit - usage.used  (aiTokenUsage.ts:37)
}

export function buildOptimizationPlan(input: PlanInput): Plan;  // PURE — deterministic, no I/O
```

Notes:
- `RoutedGuideline.reason` and `PlanStep.reason` + `Plan.ignoredLift`/`Plan.trimmed` are the **observability** surface (change 4). They feed a future UI line: "Skipped 37 potential points because of token budget."
- `PlanInput.context` carries `keyword`, `voiceTone` (brand), and `scoreData` — the planner reads them off `context`, never off the request body (ratified decision 3).
- `breakdown` is passed IN (not read off `context`) because `ArticleContext.breakdown` is typed `null` and unwired in B (`articleContext.ts:26,86`); D computes `computeContentScoreBreakdown(...)` locally in the endpoint (a pure function, `contentScore.ts:418`). Do NOT extend `ArticleContext`.
- The planner consumes `Guideline`, not raw `CoverageItem` (ratified decision 2).

---

## The 8 tech-lead changes (the heart of this revision)

### Change 1 — Richer `assignGuidelinesToSections` (deterministic scoring, not heading-overlap only)

`lib/optimizeGuidelineRouting.ts`, PURE, swappable seam. For each (guideline, section) pair compute a deterministic score from four **named, tunable** weight constants:

```ts
// tunable weights — a single-constant edit re-tunes routing
const W_HEADING = 1.0;   // heading token similarity
const W_BODY    = 0.6;   // body token similarity
const W_FREQ    = 0.5;   // section keyword frequency
const W_SECTION = 3.0;   // exact guideline.sectionId === section.id bonus (dominates when the judge localized)

matchScore(g, section) =
    W_HEADING * headingSimilarity            // overlap-coefficient of tokens(g.title + g.label) vs tokens(section.headingText)
  + W_BODY    * bodySimilarity               // overlap-coefficient of keyTerms(g) vs tokens(plainText(section.html))
  + W_FREQ    * sectionKeywordFrequency      // normalized countOccurrences(plainText, keyTerm(g)) / maxFreqAcrossSections
  + W_SECTION * sectionIdBonus               // 1 if g.sectionId === section.id (and id present in current split), else 0
```

- **headingSimilarity / bodySimilarity** use an **overlap coefficient** (|A intersect B| / min(|A|,|B|)) over lowercased word tokens (a small local tokenizer keeps routing self-contained — do NOT depend on `contentScore.tokenize`, which is Polish-stem specific). `keyTerms(g)` = distinct tokens from `g.title` + `g.instruction` (the guideline title already embeds the `CoverageItem.label`).
- **sectionKeywordFrequency** reuses `countOccurrences(plainText, keyTerm)` (`contentScore.ts:62`) and normalizes by the max frequency of that term across all sections so a long section does not always win.
- **Assignment:** each guideline goes to its single highest-scoring section. **Confidence in [0,1]** = `min(1, matchScore / CONFIDENCE_NORM)` where `CONFIDENCE_NORM` is a named constant (~ W_HEADING + W_BODY + W_FREQ; an exact `sectionId` hit saturates to 1.0). **Reason** records the dominant term ("Exact section match", "Matched entity React Hooks", "Heading overlap 0.62", "Body-term match").
- **Fallback when the best score < MATCH_THRESHOLD** (named constant): intent-category guidelines (`group === 'intent'`) route to the **intro section** (index 0); otherwise to the section with the highest `missingPoints` (from `breakdown`, passed through). Fallback assignments get low confidence and reason "Fallback — intent to intro" / "Fallback — highest missingPoints".
- **Seam:** exported behind the stable signature `assignGuidelinesToSections(guidelines, sections, opts): Map<string, RoutedGuideline[]>` so a semantic/embedding matcher can replace the scorer later WITHOUT touching the planner. No embeddings in v1.
- **Output shape (change 4):** `Map<sectionId, RoutedGuideline[]>` (NOT `Map<sectionId, Guideline[]>`), each entry carrying `confidence` + `reason` + `priority`.

**Stale-closure / heading-miss case the tech-lead raised:** when `g.sectionId` is stale (the article was edited since analysis so that id is no longer among the current split sections), `sectionIdBonus = 0` and routing falls back to heading/body/frequency scoring — never to a nonexistent section. And when NO section heading overlaps the guideline (all `headingSimilarity = 0`), the guideline still routes via body/frequency or, below threshold, via the deterministic fallback — it is never silently dropped. Both are explicitly unit-tested.

### Change 2 — Diminishing-returns `expectedLift` (not a flat sum)

Within a section, sort routed guidelines by `projectedLift` desc, then apply a **named tunable decay**:

```ts
const DECAY = [1, 0.7, 0.5, 0.3, 0.2] as const;   // floor 0.1 beyond the array
const decayAt = (i: number) => (i < DECAY.length ? DECAY[i] : 0.1);

expectedLift(section) = Math.round(
  routedSortedByLiftDesc.reduce((sum, rg, i) => sum + rg.guideline.projectedLift * decayAt(i), 0)
);
```

Rationale: overlapping guidelines on one section do not stack linearly. Worked example (tech-lead): lifts [18, 15, 12] -> 18*1 + 15*0.7 + 12*0.5 = 34.5 -> 35 (not 45). A 6th+ guideline contributes lift * 0.1.

### Change 3 — ROI-based budget trimming (not "sort by lift, keep, skip")

Before the loop, if the sum of non-skip `estimatedTokens` > `budgetRemaining`:

```ts
roi(step) = step.expectedLift / Math.max(step.estimatedTokens, 1);
// rank non-skip steps by roi desc; greedily keep while cumulative estimatedTokens <= budgetRemaining;
// drop the rest -> focus='skip', systemPrompt='', estimatedTokens=0, reason='Trimmed — budget'
```

Dropped steps' `expectedLift` accumulates into `Plan.ignoredLift`; `Plan.trimmed = true`. **Worked example:** two candidate steps, +12 @ 150 tok (roi 0.080) vs +18 @ 1200 tok (roi 0.015). ROI ranking keeps the +12/150 step first — the cheap high-yield edit beats the expensive one, the opposite of a naive lift-sort. `budgetRemaining = usage.limit - usage.used` (`aiTokenUsage.ts:37,51`).

### Change 4 — Observability fields

- Routing output is `Map<sectionId, RoutedGuideline[]>` (change 1) — `{ guideline, confidence, reason, priority }`.
- `PlanStep.reason: string` — "Optimize: N guidelines" / "Skipped — no uncovered guidelines" / "Trimmed — budget" / "Matched entity <label>".
- `Plan.ignoredLift: number` + `Plan.trimmed: boolean` — feed the future UI "Skipped 37 potential points because of token budget." Surfaced on the SSE (`done` carries `trimmed` + `ignoredLift`; `meta` optionally carries per-step reasons).

### Change 5 — `priority` sort key

```ts
const IMPORTANCE_WEIGHT: Record<Importance, number> = { critical: 3, recommended: 2, optional: 1 };
// mirrors lib/aiCoverage.ts:86 and recommendationEngine.ts:183 — the exact critical3/recommended2/optional1 map
export const importanceWeight = (imp: Importance): number => IMPORTANCE_WEIGHT[imp];

priority(rg) = importanceWeight(rg.guideline.importance) * rg.guideline.projectedLift * rg.confidence;
```

Each step's `RoutedGuideline[]` is sorted by `priority` desc (drives the prompt bullet order in `buildStepPrompt`). Step ordering keeps section order for SSE stability; `priority` (via `expectedLift`) also informs the ROI-trim so higher-priority sections survive budget pressure.

### Change 6 — `estimateStepTokens` (not `html.length / 4`)

```ts
const PROMPT_CONSTANT = 500;    // named — system-prompt + user-wrapper overhead (~400-600)
const TOKENS_PER_WORD = 1.3;    // named

const wordCount = (plain: string) => plain.split(/\s+/).filter(Boolean).length;

estimateStepTokens(section) = Math.round(
  wordCount(plainText(section.html)) * TOKENS_PER_WORD + PROMPT_CONSTANT
);
```

`plainText` reuses the tag-stripping pattern already in `optimizeSectionEdit.toPlainText` (`optimizeSectionEdit.ts:5`). `estimateStepTokens` accounts for BOTH the section body AND the fixed prompt overhead, so a tiny section is never estimated at ~0 tokens.

### Change 7 — `buildStepPrompt` structure

`buildStepPrompt(step, context)` composes the per-section system prompt (replacing the single global `buildSystemPrompt(missingTerms)`, `optimize-sections.ts:23-39`) as:

```
[shared instructions]      the existing MINIMAL surgical-edit checklist (preserve headings/links/lists/images,
                           same language, no rewrite, ~40-80 word paragraphs)
[focus-specific block]     one of:
   seo-terms:   "Weave in these MISSING NLP terms VERBATIM ..." with step.missingTerms (PER-SECTION, not article-wide)
   ai-coverage: the routed guidelines' instruction text as a directive checklist (priority-ordered)
   expand:      "Deepen this section — it is currently shallow" + the needsExpansion guideline's instruction
   readability: de-fluff / paragraph-sizing rules only
[guideline bullets]        step.guidelines (priority desc) rendered as "<title>: <instruction>" bullets
[brand voice]              when context.voiceTone present: "Match this brand voice: ..." (first time brand reaches optimize)
[NEGATIVE CONSTRAINTS]     explicit, stabilizes the LLM:
   "Do NOT: rewrite unrelated paragraphs, remove or alter existing links, remove tables/images/lists,
    duplicate or rename headings, touch other sections, translate the text, or add markdown code fences."
```

`focus==='skip'` -> `systemPrompt = ''` (no prompt built, no LLM). The negative-constraints block is NEW; the existing minimal-surgical rules are preserved verbatim.

### Change 8 — Keep everything the review praised (no regressions)

Preserve, do not regress: the Coverage->Recommendation->Planner->Optimize pipeline separation; zero new LLM call; `buildOptimizationPlan` as a PURE function; per-section `buildStepPrompt`; and the `focus:'skip'` short-circuit (emit `changed:false` SSE with NO LLM call and ZERO tokens). The retry loop, abort handling, `isUsableEdit`/`stripFences`/`normalizeHtmlForDiff` diffing, and `buildSectionEvent` SSE stay byte-for-byte the same (audit lines 452, 507).

---

## Decision rules (pseudocode)

```
buildOptimizationPlan(input):
  routed: Map<sectionId, RoutedGuideline[]> =
      assignGuidelinesToSections(input.guidelines, input.sections, { breakdown: input.breakdown })   // change 1

  steps = for each section in input.sections:
    rgs        = routed.get(section.id) ?? []                  // RoutedGuideline[], priority desc
    secText    = plainText(section.html)
    secTerms   = input.context.scoreData?.terms.filter(t =>    // per-section under-target NLP terms
                   countOccurrences(secText, t.term) < max(1, round(t.target_count * 0.7)))
                 .map(t => t.term) ?? []
    missPts    = missingPoints attributable to this section (from input.breakdown)

    // SKIP: nothing routed AND no under-target terms AND small missingPoints
    if rgs.length == 0 AND secTerms.length == 0 AND missPts is small:
        focus  = 'skip';  reason = 'Skipped — no uncovered guidelines'

    // FOCUS ROUTING (priority-guideline-driven)
    else:
        top = rgs[0]?.guideline
        if top?.group == 'intent':                          focus = 'ai-coverage'
        elif top?.effort == 'Large' (needsExpansion):        focus = 'expand'
        elif top && top.group in {'knowledge','authority'}:  focus = 'ai-coverage'
        elif secTerms.length > 0:                           focus = 'seo-terms'
        else:                                               focus = 'readability'
        reason = single-entity ? `Matched entity ${label}` : `Optimize: ${rgs.length} guidelines`

    estTokens  = focus=='skip' ? 0 : estimateStepTokens(section)                          // change 6
    expLift    = focus=='skip' ? 0 : diminishingLift(rgs.map(r => r.guideline.projectedLift))  // change 2
    sysPrompt  = focus=='skip' ? '' : buildStepPrompt(step, input.context)                // change 7
    step = { sectionId, index, headingText, html, focus, systemPrompt: sysPrompt,
             guidelines: rgs, missingTerms: secTerms, estimatedTokens: estTokens,
             expectedLift: expLift, reason }

  // ROI BUDGET TRIM (change 3)
  nonSkip = steps.filter(s => s.focus != 'skip')
  if sum(nonSkip.estimatedTokens) > input.budgetRemaining:
     rank nonSkip by roi = expectedLift / max(estimatedTokens,1) desc
     keep greedily while cumulative estimatedTokens <= budgetRemaining
     for each dropped step: focus='skip', systemPrompt='', estimatedTokens=0,
                            reason='Trimmed — budget'; ignoredLift += step.expectedLift; trimmed=true

  return { steps, estimatedTokens: sum(survivingNonSkip.estimatedTokens), trimmed, ignoredLift, rationale }
```

`priority` (change 5) is computed inside `assignGuidelinesToSections` (it needs `confidence`), so `routed`'s arrays arrive already priority-sorted.

---

## buildOptimizationPlan() plug-in point — before/after of optimize-sections.ts

The seam is exactly where the audit put it (audit lines 413-425): between `splitSections()` (`:96`) and the loop (`:106`), after the `meta` SSE event.

### Before (today, optimize-sections.ts:96-106, :150-154)

```ts
const sections = splitSections(content);
sse(res, 'meta', { total: sections.length, sections: sections.map(...) });

const missingTerms = computeMissingTerms(scoreData, content);   // :100 — ONE article-wide list
const systemPrompt = buildSystemPrompt(missingTerms);           // :101 — ONE global prompt

let changedCount = 0, aiTokens = 0;
for (const section of sections) {                               // :106 — every section, unconditionally
   ... one system prompt for all ...
   aiTokens += data.usage?.total_tokens || 0;                   // :129 — single accumulator
}
const creditDeducted = orgId != null && shouldChargeCredit(changedCount, aiTokens);  // :151 — after loop only
if (creditDeducted) await recordAiTokens(orgId, aiTokens);      // :152
sse(res, 'done', { changedCount, total: sections.length, promptVersion, creditDeducted });  // :154
```

### After (D)

```ts
const sections = splitSections(content);
sse(res, 'meta', { total: sections.length, sections: sections.map(...) });

// Server-side context (ratified decision 3) — never trust client-sent coverage/keyword/brand.
const ctx = articleId != null ? await buildArticleContext(Number(articleId)) : null;   // B, articleContext.ts:38
const snapshot = ctx?.coverage ?? null;
const guidelines = snapshot ? buildGuidelines(snapshot, ctx ?? undefined) : [];         // C, recommendationEngine.ts:155

// breakdown is null-typed on ArticleContext -> compute locally (pure, contentScore.ts:418).
// counts via computePlannerContentMetrics: a module-PRIVATE endpoint adapter (not exported / not a shared util).
const m = computePlannerContentMetrics(content);   // { wordCount, headingCount, paragraphCount }
const breakdown = ctx?.scoreData
   ? computeContentScoreBreakdown(plainText(content), m.wordCount, m.headingCount, ctx.scoreData, m.paragraphCount, content, ctx.keyword, undefined, snapshot?.items)
   : { slots: [], totalPossible: 0 };

const usage = orgId != null ? await getOrgUsage5h(orgId) : { used: 0, limit: AI_TOKEN_LIMIT_5H, resetsAt: 0, over: false };

// Two disjoint modes: articleId present -> Planner v2; absent -> legacyPlan (byte-for-byte today's optimizer).
const plan = ctx
   ? buildOptimizationPlan({ sections, guidelines, breakdown, context: ctx, budgetRemaining: usage.limit - usage.used })
   : legacyPlan(sections, scoreData, content);   // fallback: draft/unsaved article w/o articleId

if (plan.trimmed) sse(res, 'meta', { trimmed: true, ignoredLift: plan.ignoredLift });

let changedCount = 0;
let aiTokens = 0;                                   // accumulated PER STEP, recorded in `finally` (below)
try {
  for (const step of plan.steps) {                  // was: for (const section of sections)
     if (aborted) break;
     if (step.focus === 'skip') {                   // change 8 — no LLM, no tokens
        sse(res, 'section', buildSectionEvent(sectionOf(step), { oldHtml: step.html, newHtml: step.html, changed: false }));
        continue;
     }
     // ... identical retry/abort/fetch loop as today (:111-138), EXCEPT:
     //     messages[0].content = step.systemPrompt   (per-step, not global)
     //     aiTokens += data.usage?.total_tokens || 0 (same accumulator, now per surviving step)
     // ... identical changed-diff + section SSE (:142-145) ...
  }
} finally {
  // B "cubic-P1" pattern — record spend even on mid-run throw, not only on full success.
  // Precedent: pages/api/articles/deep-analysis.ts:566-571 (finally { recordAiTokens }).
  if (!aborted && orgId != null && shouldChargeCredit(changedCount, aiTokens)) {
     await recordAiTokens(orgId, aiTokens);
  }
}
if (aborted) return;
const creditDeducted = orgId != null && shouldChargeCredit(changedCount, aiTokens);
sse(res, 'done', { changedCount, total: plan.steps.length, promptVersion: PROMPT_VERSION, creditDeducted, trimmed: plan.trimmed, ignoredLift: plan.ignoredLift });
```

The only structural edits: (1) iterate `plan.steps` not `sections`; (2) `focus==='skip'` short-circuits to a `changed:false` event; (3) `systemPrompt` is `step.systemPrompt`; (4) `recordAiTokens` moves into `finally`; (5) `done`/`meta` carry `trimmed`/`ignoredLift`.

---

## Token / credit model

**Pre-run gate (two layers):**
1. **Fast-fail hard gate** — keep `optimize-sections.ts:67-72`: if `getOrgUsage5h(orgId).over` -> HTTP 429 `org_limit` before any SSE. Unchanged.
2. **ROI-aware trim** — new, inside `buildOptimizationPlan` (change 3): `budgetRemaining = usage.limit - usage.used`. If the sum of non-skip `estimatedTokens` > `budgetRemaining`, rank non-skip steps by `roi = expectedLift / max(estimatedTokens,1)`, keep greedily what fits, demote the rest to `skip`, set `plan.trimmed` + accumulate `plan.ignoredLift`. A partial high-ROI run beats a 429.

**Per-step accounting (B cubic-P1 fix):** `aiTokens` accumulates across surviving steps and `recordAiTokens` runs in a `finally` so spend is recorded even if a later step throws mid-run — not only on full success as today (`optimize-sections.ts:150-152` runs after the loop, skipped on throw). Precedent: `pages/api/articles/deep-analysis.ts:566-571`.

**Skip = free:** `focus:'skip'` steps make ZERO LLM calls and add ZERO tokens (audit line 448), emitting `changed:false` directly. An 8-H2 article where 5 sections are already covered -> 3 LLM calls instead of 8.

**Post-run charge:** keep the existing all-or-nothing `shouldChargeCredit(changedCount, aiTokens)` (`optimizeSectionEdit.ts:43-45`). Fractional per-section charging is a non-goal.

---

## Request body / server-side context

Today the endpoint receives `{ content, articleId, scoreData }` (`optimize-sections.ts:46-50`). D derives planner inputs SERVER-SIDE via `buildArticleContext(articleId)` (`articleContext.ts:38`), which aggregates `coverage` (snapshot), `keyword`, `paa`, `voiceTone`, `scoreData`, `terms`, `competitors` from the DB (`articleContext.ts:81-99`). Rationale: **security** (client cannot spoof coverage/brand to steer prompts) + **DRY** (one aggregator, merged in B).

**Caveat (baked in):** `ArticleContext.breakdown` is typed `null` (`articleContext.ts:26,86`) — B left it unwired. D needs per-slot `missingPoints`, so D computes `computeContentScoreBreakdown(...)` in the endpoint from `ctx.scoreData` + `content` (pure, `contentScore.ts:418`). The three counts it needs come from `computePlannerContentMetrics(content)` — a **module-private** endpoint adapter, NOT exported and NOT a shared utility (derive-on-read, not persist-and-propagate). Do NOT extend `ArticleContext`. Keep the live editor `content` body param (may be newer than the DB) and keep `scoreData` as a fallback path when `articleId` is absent (draft/unsaved articles).

**Two disjoint modes (ratified):** `articleId` present → Planner v2 (routing/ROI/skip/per-section prompt); `articleId` absent → `legacyPlan`, which MUST reproduce today's optimizer **byte-for-byte** — single global `buildSystemPrompt(computeMissingTerms(...))`, article-wide missing terms, NO routing, NO ROI trim, NO skip, NO per-section prompt. This guarantees zero behavioural regression for unsaved drafts and keeps the two paths trivially testable in isolation. It is NOT a "Planner Lite".

---

## Data-flow diagram

```
optimize-sections POST { content, articleId, scoreData? }
        |
        |- verifyUser + assertArticleAccess (optimize-sections.ts:42-60)   [unchanged]
        |- getOrgUsage5h -> hard 429 if over (optimize-sections.ts:67-72)  [unchanged fast-fail]
        |
        v
   splitSections(content) -> Section[]           (articleSections.ts:30)
        |   sse 'meta'
        v
   buildArticleContext(articleId) -> ArticleContext   (B, articleContext.ts:38)   [server-side, not client]
        |        |- coverage (CoverageSnapshot)   |- keyword / voiceTone / scoreData / paa
        v
   buildGuidelines(snapshot, ctx) -> Guideline[]      (C, recommendationEngine.ts:155)   [NO LLM]
        |
        |   computeContentScoreBreakdown(scoreData, content) -> { slots.missingPoints }  (contentScore.ts:418)  [local]
        v
   buildOptimizationPlan({ sections, guidelines, breakdown, context, budgetRemaining })       [PURE, NO LLM]
        |        |- assignGuidelinesToSections -> Map<sectionId, RoutedGuideline[]>  (change 1: scoring + confidence + reason)
        |        |- per-section focus + secTerms (countOccurrences)  (contentScore.ts:62)
        |        |- diminishing-returns expectedLift (change 2) + priority (change 5)
        |        |- estimateStepTokens (change 6)
        |        |- ROI budget trim (change 3) -> trimmed / ignoredLift (change 4)
        v
   Plan { steps: PlanStep[], estimatedTokens, trimmed, ignoredLift, rationale }
        |   sse 'meta' { trimmed, ignoredLift } when trimmed
        v
   for step of plan.steps:                        (was: for section of sections)
        |- focus==='skip' -> sse 'section' changed:false        [0 tokens]
        |- else -> DeepSeek edit with step.systemPrompt          (optimize-sections.ts:113-126)  [1 LLM call/step]
                     |- retries / abort / stripFences / isUsableEdit           [unchanged]
                     |- aiTokens += usage.total_tokens                          [per-step accumulator]
                     |- sse 'section' buildSectionEvent(...)                    [unchanged]
        |
        v  finally: shouldChargeCredit -> recordAiTokens   (B cubic-P1, deep-analysis.ts:566-571)
   sse 'done' { changedCount, total, promptVersion, creditDeducted, trimmed, ignoredLift }
        |
        v
   [UNCHANGED downstream] buildReviewDoc -> TipTap contentOptimizer atoms -> Accept/Reject
```

---

## Worked numeric examples (for reviewer confidence)

**Diminishing returns (change 2):** a section routes 3 guidelines with lifts [18, 15, 12].
18*1.0 + 15*0.7 + 12*0.5 = 18 + 10.5 + 6 = 34.5 -> round -> 35. (Flat sum would have been 45.)

**ROI trim (change 3):** budgetRemaining = 1000 tokens; two non-skip steps survive routing:
- Step A: expectedLift 12, estimatedTokens 150 -> roi = 0.080
- Step B: expectedLift 18, estimatedTokens 1200 -> roi = 0.015

ROI ranking: A (0.080) before B (0.015). Keep A (cumulative 150 <= 1000). B does NOT fit (150 + 1200 = 1350 > 1000) -> B demoted to skip, ignoredLift += 18, trimmed = true. Result: the cheap +12 edit runs; the expensive +18 is deferred — the exact inversion a naive lift-sort would get wrong.

**estimateStepTokens (change 6):** a section with 220 plain-text words -> round(220 * 1.3 + 500) = round(786) = 786 tokens.

**priority (change 5):** a critical guideline, projectedLift 15, routing confidence 0.8 -> 3 * 15 * 0.8 = 36. A recommended guideline, projectedLift 20, confidence 0.5 -> 2 * 20 * 0.5 = 20. The critical item sorts first in the bullet list despite the lower raw lift.

---

## Testing (LOCAL jest.mock only — never global jest infra; [[avoid-any-type]])

- **assignGuidelinesToSections** (`lib/optimizeGuidelineRouting.ts`, pure, heavily tested):
  - exact `sectionId` match -> that section, confidence saturates to 1.0, reason "Exact section match";
  - **stale sectionId** (id not among current split sections) -> `sectionIdBonus=0`, falls through to heading/body scoring (the tech-lead stale-closure case);
  - **heading-miss** (no heading token overlaps any section) -> routes via body/frequency, and below threshold via fallback — never dropped;
  - entity guideline -> highest body-frequency section, reason "Matched entity <label>";
  - intent guideline below threshold -> intro (index 0);
  - below-threshold non-intent -> highest-missingPoints section;
  - confidence in [0,1] always; priority = importanceWeight*lift*confidence and arrays arrive priority-sorted.
- **buildOptimizationPlan** (`lib/optimizationPlanner.ts`, pure):
  - skip when nothing routed + no under-target terms + small missingPoints (reason "Skipped — no uncovered guidelines");
  - focus routing precedence (intent->ai-coverage, needsExpansion->expand, knowledge/authority->ai-coverage, terms->seo-terms, else readability);
  - **diminishing-returns** expectedLift = the [18,15,12]->35 example (not 45);
  - estimatedTokens sums non-skip only;
  - **ROI trim** demotes the low-roi step (the +12/150 beats +18/1200 example), sets trimmed, accumulates ignoredLift.
- **estimateStepTokens** — round(words*1.3 + 500); tiny section still ~ PROMPT_CONSTANT (never ~0).
- **buildStepPrompt** — per-focus block content; per-section secTerms (not article-wide); brand voice appended when `context.voiceTone` present, omitted when absent; **NEGATIVE CONSTRAINTS block present**; guideline bullets in priority order; skip -> ''.
- **Endpoint** (extend `__tests__/api/articles-optimize-sections-guard.test.ts`, LOCAL mock of `buildArticleContext`/`getOrgUsage5h`): skip steps emit `changed:false` with NO fetch; `recordAiTokens` called in `finally` even on mid-run throw; ROI-trim path; `done`/`meta` carry `trimmed`/`ignoredLift`.
- **Regression:** `computeMissingTerms`/`countOccurrences`/`splitSections`/review-doc/Accept-Reject all green; `tsc` clean; the `focus:'skip'` short-circuit + zero-token skip preserved (change 8). Implementers must NOT run `npm run build` (controller runs it once at the end).

---

## Proposed task breakdown (detailed TDD plan: docs/superpowers/plans/2026-07-01-planner-optimize.md)

1. `assignGuidelinesToSections` scoring core — matchScore (4 weighted terms) + confidence + reason, pure.
2. `assignGuidelinesToSections` fallback + priority + stale-sectionId / heading-miss edge cases.
3. Pure primitives — plainText/wordCount helpers + estimateStepTokens + diminishing-lift decayAt + importanceWeight.
4. buildOptimizationPlan + types — focus routing, expectedLift, skip decision.
5. ROI budget trim inside the planner — trimmed / ignoredLift.
6. buildStepPrompt — shared + focus blocks + priority bullets + NEGATIVE CONSTRAINTS + brand voice.
7. Endpoint wiring — buildArticleContext server-side, private computePlannerContentMetrics + local computeContentScoreBreakdown, insert planner at the :96->:106 seam, iterate plan.steps, skip short-circuit, per-step prompt, byte-for-byte `legacyPlan` fallback.
8. Per-step token accounting in finally (B cubic-P1) + done/meta trimmed/ignoredLift SSE + skip regression test.

~8 tasks (the review's ~7 split once to give the richer routing scoring + its edge cases their own tasks). Effort: **Medium** — no review-doc/Accept-Reject/TipTap changes; the loop dispatcher/retries/abort/SSE are reused unchanged; the new surface is two pure modules + endpoint rewiring.

---

## Conflicts — RESOLVED by tech-lead review (2026-07-01)

- **computeContentScoreBreakdown counts → ✅ RESOLVED.** D computes `wordCount`/`headingCount`/`paragraphCount` locally via `computePlannerContentMetrics(content)` — a **module-private** endpoint adapter, NOT exported and NOT a shared utility. It is the one place D touches score internals; approved as an adapter, not a new public API.
- **ArticleContext.breakdown stays null-typed (B frozen) → ✅ RESOLVED.** D computes breakdown locally (derive-on-read, not persist-and-propagate). B is NOT reopened.
- **Legacy fallback for draft articles (no articleId) → ✅ RESOLVED.** Two disjoint modes; `legacyPlan` MUST reproduce today's optimizer **byte-for-byte** (single global prompt, article-wide missing terms, no routing/ROI/skip). Progressive enhancement: drafts optimize as today, saved articles get Planner v2.
- **Planner output shape → ✅ RESOLVED.** D uses `guidelines: Guideline[]` (C owns the actionable shape), not the audit's older `CoverageItem[]` sketch.

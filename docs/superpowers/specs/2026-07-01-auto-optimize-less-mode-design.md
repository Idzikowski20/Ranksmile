# Auto-Optimize "Less" Mode — the missing `worthEditing` decision layer + edit modes (Sub-project F) — Design

**Date:** 2026-07-01
**Branch:** `feature/less-mode`
**Status:** Draft v1 — implements the tech-lead's approved 5-pillar direction. Fixes the root causes named in `docs/2026-07-01-auto-optimize-root-cause-report.md` (RCA).
**Root-cause source (grounding):** `docs/2026-07-01-auto-optimize-root-cause-report.md` — §1 (no "good enough" gate, skip only at `rgs===0 && secTerms===0`), §2/§E (intent→intro magnet grows H1), §3/§7 (prompt ratchets toward expansion; "only refine or expand" + "40-80 words"), §5 (`expectedLift` computed but never a threshold, only ROI-trim), §6/§F (guideline bar too low, quality<4 → guideline).
**Depends on:** D (Planner + Auto-Optimize wiring, merged: `lib/optimizationPlanner.ts`, `lib/optimizeGuidelineRouting.ts`, endpoint rewiring) + C (`lib/recommendationEngine.ts` `buildGuidelines`) + B (`lib/articleContext.ts` `buildArticleContext`) + A (`lib/aiCoverage.ts` snapshot). Reuses D's `PlanInput`/`PlanStep`/`Plan`, `assignGuidelinesToSections`, `diminishingLift`, `buildStepPrompt`.
**Independent of E:** uses the EXISTING `expectedLift`/`projectedLift` + SEO/AI scores, NOT E's `sectionMissingPoints`. Once E ships a real per-section `sectionMissingPoints`, `worthEditing` can consume it as a strictly better deficit signal (noted in Non-goals).

## Goal

Insert the **`worthEditing` decision layer** and a **three-mode edit taxonomy (LESS / NORMAL / EXPAND)** into the planner so Auto-Optimize does minimal "Less"-style patches instead of rewriting whole articles. Today the planner has NO "good enough" gate: the only skip is `rgs.length === 0 && secTerms.length === 0` (`lib/optimizationPlanner.ts:92`), which almost never fires because routing force-assigns every guideline (`lib/optimizeGuidelineRouting.ts:94-115`) and per-section 70%-target term flagging (`lib/optimizationPlanner.ts:66-71`) makes `secTerms` almost always non-empty (RCA §1). `expectedLift` is computed (`lib/optimizationPlanner.ts:96`) but used ONLY inside `trimToBudget` when over budget (`:116-135`), never as a benefit threshold (RCA §5). And the single per-section prompt path ("Improve this section:\n\n" + full HTML, `pages/api/articles/optimize-sections.ts:165`) frames every edit as "improve the whole section" (RCA §3/§7).

F adds a benefit-threshold layer on top of D's PURE `buildOptimizationPlan`, keyed on `expectedLift` tiers plus two new score inputs (SEO score, AI score) threaded into `PlanInput` from the endpoint:

`Coverage (A) → Recommendation (C) → Planner (D) "where + whether" → worthEditing + mode (F) "how much" → Auto-Optimize "how".`

**Defining constraint — NORMAL is byte-for-byte today's behaviour.** F is purely ADDITIVE below/around the existing pipeline. A section that F classifies NORMAL produces the EXACT same `systemPrompt` (`SHARED_RULES + focusBlock + brand + NEGATIVE_CONSTRAINTS + OUTPUT`, `lib/optimizationPlanner.ts:138-175`) AND the exact same user message (`"Improve this section:\n\n" + section.html`, `optimize-sections.ts:165`) as before this sub-project. LESS and EXPAND are new; everything outside LESS/EXPAND regresses zero. A dedicated all-NORMAL regression test proves the section events + prompts are unchanged.

---

## Open decisions for review

Each is a real knob the tech-lead flagged. Recommendation + rationale, then the doc bakes the recommendation into the rules below.

### OD-1 — Exact thresholds on the 0–100 integer AI-score scale

`projectedLift`/`expectedLift` are integer AI-search-score points (0–100): `projectedLift = scoreContribution(item, snapshot)` (`lib/recommendationEngine.ts:159`), and `expectedLift = diminishingLift(rgs.map(r => r.guideline.projectedLift))` (`lib/optimizationPlanner.ts:96,60-63`) — a rounded diminishing-returns sum of those point values, so it lives on the same 0–100 AI-score scale.

**Recommendation:** adopt the tech-lead's starting numbers as named TUNABLE constants, confirmed against the scale:
- `LESS_MIN = 6` — below 6 predicted AI-score points the edit is not worth an LLM call → **skip**.
- `NORMAL_MIN = 12` — 6..12 → **LESS**; > 12 → **NORMAL**.
- `SEO_HIGH = 85` — SEO score at/above which the AI-takeover rule drops NLP-term injection.
- `INTENT_INTRO_MIN = 50` — intent-bucket score below which the intro may be edited (else LESS-only, EXPAND blocked).

Rationale: `expectedLift` of a single recommended guideline (`projectedLift` typically ~5–15 via `scoreContribution`) lands most low-value sections in the 6–12 LESS band and reserves NORMAL for sections with a critical or multi-guideline deficit (diminishing sum > 12). 85 matches the AI-coverage blend cap (`blendBuckets` caps the bucket-blend at 85, `lib/aiCoverage.ts:159-167`), so "SEO already maxed" is a natural takeover trigger. All four are module constants — a single-line edit re-tunes.

### OD-2 [RATIFIED] — Term-only sections (`expectedLift === 0`) → LESS (minimal weave), dropped only by AI-takeover

RCA nuance: a section whose ONLY deficit is missing NLP terms has `rgs = []` → `expectedLift = diminishingLift([]) = 0` (`lib/optimizationPlanner.ts:60-63,96`), yet today it is NOT skipped because `secTerms.length > 0` defeats the skip predicate (`:92`) and `focusFor` returns `'seo-terms'` (`:78`).

**[RATIFIED] decision (tech-lead):** a term-only section (`rgs=[]`, `secTerms>0`, `expectedLift=0`) is **worth a LESS (minimal) edit — NOT skipped** — because SurferSEO's "Less" still weaves missing terms minimally. Such sections are dropped ONLY when the AI-search takeover fires (high SEO). Concretely: `TERM_WORTH_FLOOR = 1` (was 0) — a section with `>=1` under-target term (when NOT in `aiTakeover`) passes `worthEditing`, and `selectMode` maps it to **LESS** (lift 0 falls through the NORMAL tier). Rationale: (a) it matches Surfer's "Less" behaviour of minimally weaving missing terms rather than skipping them; (b) `aiTakeover === true` still suppresses the term path (the `!aiTakeover` guard), so "SEO maxed, AI lags" correctly drops term stuffing. A guideline-only section with `expectedLift < LESS_MIN` and no terms/critical still SKIPS via `worthEditing` — `LESS_MIN` keeps filtering weak guideline-only sections. Note: the current per-section 70%-target term signal (`sectionMissingTerms`, `optimizationPlanner.ts:66-71`) is noisier than Surfer's article-level term model, so an article-level term-targeting pass is a future follow-up (E / CoverageGraph territory) — but v1 keeps the per-section signal driving a LESS edit. This reverses today's `secTerms`-defeats-skip default into a deliberate term-only → LESS classification — see the [RATIFIED] note at the end.

### OD-3 — "AI low" definition for the takeover

**Recommendation:** **relative gap** — takeover fires when `seoScore >= SEO_HIGH AND (seoScore - aiScore) > AI_GAP` with `AI_GAP = 25`. Rationale: an absolute `aiScore < X` mis-fires on articles that are weak on BOTH axes (where term work still helps SEO); the relative gap targets exactly the RCA scenario "SEO is maxed but AI-search coverage lags", which is where dropping term injection and routing only AI-search work is correct. `AI_GAP` is a named tunable constant. (Absolute is available as a fallback by setting `AI_GAP = SEO_HIGH - aiThreshold`; we prefer the gap form for clarity.)

### OD-4 — Where the mode's user-message lives

**Recommendation:** **on `PlanStep.userInstruction`** (planner-owned, pure, testable). `buildOptimizationPlan` sets `step.mode` and `step.userInstruction`; the endpoint reads `step.userInstruction ?? ` today's `Improve this section` literal as the user message. Rationale: keeps mode → user-message a PURE, unit-testable decision inside the planner (the D constraint "Mode + skip decisions are PURE in `buildOptimizationPlan`"), avoids a `switch (step.mode)` string-literal fork hardcoded in the endpoint that no planner test can cover, and lets the all-NORMAL regression assert the exact user message from the plan object without spinning up the SSE loop. NORMAL leaves `userInstruction` UNDEFINED so the endpoint's existing literal is used verbatim — byte-for-byte.

### OD-5 — EXPAND as a separate mode vs a NORMAL variant flag

**Recommendation:** **separate mode** (`mode: 'expand'`). Rationale: EXPAND has a materially different prompt AND a different gate (only when `item.needsExpansion` OR a critical coverage item is missing — NOT the default), and the intro-protection rule must be able to BLOCK EXPAND independently of NORMAL. A boolean variant flag on NORMAL would entangle the "byte-for-byte NORMAL" guarantee with expand logic and make the intro-block harder to reason about. Three explicit modes keep each prompt, gate, and test independent. Note: today `focus: 'expand'` already exists (`lib/optimizationPlanner.ts:76`, `StepFocus`); F promotes the expand DECISION to the new `mode` axis (orthogonal to `focus`) so `focus` stays the prompt-block selector and `mode` becomes the edit-intensity selector.

---

## Pipeline — BEFORE / AFTER

### BEFORE (today, D merged)

```
buildOptimizationPlan(input):                                       (optimizationPlanner.ts:82)
  routed = assignGuidelinesToSections(guidelines, sections)         (:83)
  for each section:
    rgs      = routed.get(section.id) ?? []                         (:86)
    secTerms = sectionMissingTerms(secText, ctx)                    (:88, :66-71)
    if rgs.length===0 && secTerms.length===0 -> focus 'skip'        (:92)   <- ONLY skip, near-never
    else:
      focus = focusFor(rgs, secTerms)                               (:95, :73-80)
      expectedLift = diminishingLift(...projectedLift)              (:96)   <- computed, unused as gate
      systemPrompt = buildStepPrompt(...)                           (:100, :170)
  trimToBudget(steps, budgetRemaining)                             (:106, :116)  <- ONLY expectedLift use
endpoint loop: user = "Improve this section:\n\n"+section.html       (optimize-sections.ts:165)  <- always
```

### AFTER (F) — new `worthEditing` node + `selectMode` node inserted per section

```
buildOptimizationPlan(input):                                       (PURE - now also reads seoScore, aiScore)
  routed = assignGuidelinesToSections(input.guidelines, input.sections)   (unchanged, :83)
  aiTakeover = seoScore >= SEO_HIGH && (seoScore - aiScore) > AI_GAP   <- NEW  (OD-1, OD-3)
  for each section:
    rgs      = routed.get(section.id) ?? []
    secTerms = aiTakeover ? [] : sectionMissingTerms(secText, ctx)   <- NEW: takeover drops term work (pillar 5)
    expectedLift = diminishingLift(rgs.map(r => r.guideline.projectedLift))   (moved up - always computed)

    // --- NEW NODE 1: worthEditing gate ---
    if !worthEditing({ expectedLift, rgs, secTerms, aiTakeover }):   <- replaces the rgs===0 && secTerms===0 test
        focus='skip'; mode='normal'; reason='Skipped - below benefit threshold'
        continue

    // --- NEW NODE 2: selectMode (expectedLift tiers + intro guard + expand gate) ---
    focus = focusFor(rgs, secTerms)                                  (unchanged block selector, :73-80)
    mode  = selectMode({ section, expectedLift, rgs, snapshot, aiTakeover })   <- LESS | NORMAL | EXPAND
    systemPrompt    = buildStepPromptForMode(step, ctx, mode)        <- NORMAL delegates to buildStepPrompt (byte-for-byte)
    userInstruction = userInstructionForMode(section, mode)         <- NORMAL: undefined (endpoint uses today's literal)

  trimToBudget(steps, budgetRemaining)                              (unchanged, :116)
endpoint loop:
  user = step.userInstruction ?? "Improve this section:\n\n"+section.html    <- NORMAL path unchanged  (OD-4)
```

The two new nodes (`worthEditing`, `selectMode`) are PURE functions in `lib/optimizationPlanner.ts`. Everything D built (routing, `focusFor`, `diminishingLift`, `trimToBudget`, `buildStepPrompt`, the SSE loop, retries, abort, credit finally) is untouched except: (1) the skip predicate becomes `!worthEditing(...)`; (2) each non-skip step gains `mode` + optional `userInstruction`; (3) `systemPrompt` for LESS/EXPAND comes from mode-specific builders; (4) the endpoint's user message reads `step.userInstruction ??` the existing literal.

---

## Mode taxonomy + selection rules (pseudocode)

Three modes on a NEW `PlanStep.mode` axis, orthogonal to the existing `focus` (which still selects the focus BLOCK inside NORMAL/LESS prompts):

| mode | when | prompt intensity |
|---|---|---|
| **skip** | `!worthEditing` - `expectedLift < LESS_MIN` (and not a critical-miss override) | none, 0 tokens |
| **LESS** | `LESS_MIN <= expectedLift <= NORMAL_MIN`, OR a term-only section (`expectedLift 0`, passed `worthEditing` via terms, not in aiTakeover), OR intro-guarded section | 2-5 local patches, preserve >95% wording, no new paragraphs |
| **NORMAL** | `expectedLift > NORMAL_MIN` and not expand-eligible | today's prompt byte-for-byte |
| **EXPAND** | `item.needsExpansion` OR a **critical** coverage item missing - AND not intro-blocked | deepen; may add content |

```
LESS_MIN = 6            // OD-1 - tunable
NORMAL_MIN = 12         // OD-1
SEO_HIGH = 85           // OD-1
AI_GAP = 25             // OD-3
INTENT_INTRO_MIN = 50   // OD-1
TERM_WORTH_FLOOR = 1    // OD-2 [RATIFIED] - a section with >=1 under-target term (when NOT in aiTakeover) is worth a LESS edit

worthEditing({ expectedLift, rgs, secTerms, aiTakeover }) -> boolean:
  // pillar 1 + 2 + OD-2: a real "good enough" cut keyed on predicted benefit, not force-assign.
  if hasCriticalMiss(rgs): return true                     // never skip a critical coverage gap
  if expectedLift >= LESS_MIN: return true                 // LESS band or above
  // term-only deficit (rgs empty -> expectedLift 0): worth a LESS (minimal) edit unless AI-takeover drops it (OD-2 [RATIFIED]).
  if !aiTakeover && secTerms.length >= TERM_WORTH_FLOOR:
      return true
  return false                                             // below benefit threshold -> skip

hasCriticalMiss(rgs) -> boolean:
  return rgs.some(r => r.guideline.importance === 'critical')   // importance from Guideline (aiCoverage Importance)

selectMode({ section, expectedLift, rgs, snapshot, aiTakeover }) -> Mode:
  expandEligible = rgs[0]?.guideline.effort === 'Large'        // needsExpansion||missing>5 -> Large (effortOf, recommendationEngine.ts:35-40)
                   || hasCriticalMiss(rgs)
  // --- intro (index 0) protection: LESS-only, EXPAND blocked, unless intent bucket weak (pillar 4) ---
  if section.index === 0 && !introMayExpand(snapshot):
      return 'less'                                           // never NORMAL/EXPAND on a healthy intro
  if expandEligible:  return 'expand'
  if expectedLift > NORMAL_MIN:  return 'normal'              // then EXPAND/intro rules as above
  return 'less'                                               // else -> LESS: LESS_MIN..NORMAL_MIN band AND term-only sections (lift 0, passed worthEditing via terms)

introMayExpand(snapshot) -> boolean:
  // pillar 4: intro may be NORMAL/EXPAND only when intent is genuinely weak.
  intentScore = snapshot.buckets.find(b => b.key === 'intent')?.score ?? 0   (aiCoverage.ts:77 buckets; BucketScore.score 0..100, :66)
  return intentScore < INTENT_INTRO_MIN || snapshot.answersMainQuestionEarly === false   (aiCoverage.ts:77)
```

`mode`/`worthEditing`/`selectMode` are PURE given `PlanInput` (D constraint). `snapshot` reaches them via `input.context.coverage` (`articleContext.ts:52`, non-null in the planner path). `aiTakeover`, `seoScore`, `aiScore` are threaded into `PlanInput` (below).

---

## The three prompts

### LESS - NEW system prompt AND NEW user message (must NOT reuse "Improve this section")

The current `"Improve this section"` framing (`optimize-sections.ts:165`) MUST NOT be used for LESS. LESS gets its own system prompt (replacing SHARED_RULES' growth ratchets - RCA §3 - the "only refine or expand" + "40-80 words" lines at `optimizationPlanner.ts:145-146` are DROPPED for LESS) and its own patch-only user message.

**LESS system prompt** (new constant `LESS_RULES` in `lib/optimizationPlanner.ts`):
```
You are an expert SEO content editor making a MINIMAL PATCH to ONE section of an HTML article.

RULES:
- Make a MAXIMUM of 2-5 local edits. Preserve MORE THAN 95% of the original wording verbatim.
- Do NOT add paragraphs. Do NOT rewrite. Do NOT expand or lengthen the section.
- Only patch the specific uncovered AI-search signals listed below - change nothing else.
- Keep the SAME LANGUAGE as the input (auto-detect - do NOT translate).
- Preserve EVERY heading, <a> link, <img>, and list EXACTLY as written.
```
followed by the SAME focus block (`focusBlock(step)`, `:152`) as NORMAL for the routed guidelines/terms, then brand voice, then `NEGATIVE_CONSTRAINTS` (`:148`) and `OUTPUT_RULE` (`:150`) verbatim. Note LESS OMITS `SHARED_RULES` lines 145-146 (the growth ratchets) - that is the whole point.

**LESS user message** (`step.userInstruction`, OD-4):
```
Patch this section with the minimal number of local edits. Do not rewrite it, do not add
paragraphs, and preserve more than 95% of the wording. Only fix the signals in the instructions.

<section html>
```

### NORMAL - today's prompt BYTE-FOR-BYTE (zero regression)

NORMAL calls the EXISTING `buildStepPrompt(step, context)` (`optimizationPlanner.ts:170-175`) unchanged: `SHARED_RULES` (`:138-146`, including lines 145-146) + `focusBlock` (`:152-168`) + brand + `NEGATIVE_CONSTRAINTS` (`:148`) + `OUTPUT_RULE` (`:150`). `step.userInstruction` is UNDEFINED for NORMAL, so the endpoint uses the `Improve this section:\n\n` + `section.html` literal verbatim (`optimize-sections.ts:165`). No new bytes on any NORMAL step.

### EXPAND - only when `needsExpansion` OR a critical coverage item is missing

EXPAND is NOT the default (RCA §8: today ANY `effort === 'Large'` guideline flips `focus` to expand via `focusFor`, `:76`). F gates EXPAND behind `expandEligible = topGuideline.effort === 'Large' || hasCriticalMiss(rgs)` AND `selectMode` only reaches it after the intro guard. EXPAND system prompt = NORMAL's `buildStepPrompt` with the existing `focus: 'expand'` block ("deepen this section; it is currently shallow", `:161-162`) - reused as-is; `userInstruction` = today's `Improve this section` literal (undefined -> endpoint default). EXPAND is thus the ONLY mode allowed to lengthen, and only under its gate.

---

## Intro (section index 0) protection

RCA §2/§E: intent guidelines fall to intro via `fallbackSection` (`optimizeGuidelineRouting.ts:74-76`) and their copy says "Rewrite the first paragraph" / "In the introduction..." (`recommendationEngine.ts:54-58`), so H1 grows 3 paragraphs. F does NOT change routing (D-frozen); it constrains the MODE of section 0:

- **Default:** section 0 is **LESS-only, EXPAND blocked** - `selectMode` returns `'less'` for index 0 regardless of `expectedLift`, so intro never gets NORMAL/EXPAND (no paragraph growth).
- **Override:** allowed to be NORMAL/EXPAND ONLY when `introMayExpand(snapshot)` - i.e. the intent bucket score `< INTENT_INTRO_MIN (50)` OR `snapshot.answersMainQuestionEarly === false` (`aiCoverage.ts:77`). That is exactly the case where the intro genuinely fails its job and deserves real work.
- **LESS-on-intro constraint:** when intro IS edited in LESS, the LESS user message for index 0 adds a one-sentence directive: "If the intro does not directly answer the main question, add AT MOST one short sentence that does - never a new paragraph." So the strongest intro edit is a single answer sentence, never new paragraphs.

---

## AI-Search takeover rule (pillar 5)

When SEO is high and AI-search lags, drop term work and route only AI-search signals:

- **Trigger (OD-3):** `aiTakeover = seoScore >= SEO_HIGH (85) && (seoScore - aiScore) > AI_GAP (25)`.
- **Effect:**
  1. `secTerms = []` for every section (no `sectionMissingTerms` call) -> no `focus: 'seo-terms'`, no term bullets.
  2. `worthEditing` ignores term-only deficits entirely — the `!aiTakeover` guard on the `TERM_WORTH_FLOOR` branch is false under takeover, so term-only sections that would otherwise get a LESS edit are DROPPED (OD-2 [RATIFIED]).
  3. Only AI-search guidelines survive as routed work: intent / direct answer / missing questions / knowledge / authority / citations - i.e. the `intent`, `knowledge`, `authority` groups (`recommendationEngine.ts` `categoryToGroup`), which drive `focus: 'ai-coverage'` via `focusFor` (`optimizationPlanner.ts:75,77`).
- **Score sources threaded into `PlanInput`:**
  - `seoScore` = `computeContentScore(...)` -> the SEO score (`lib/contentScore.ts:386`), already persisted as `content_score` / `scoreData._computed_score` (`pages/api/articles/[id]/index.ts:78`). The endpoint reads it; it is NOT recomputed in the planner.
  - `aiScore` = `computeAiSearchScore(summary)` -> the AI-search score (`lib/aiSearchScore.ts:19`), persisted as the latest `ai_visibility_runs.score` (`lib/aiVisibilityStore.ts:14`; read pattern at `pages/api/articles/[id]/index.ts:46-52`).
  - (`snapshot.overall` at `aiCoverage.ts:79` is the AI-COVERAGE pillar and is already in `context.coverage`; `aiScore` here is the distinct AI-SEARCH visibility score.)

---

## Type model - `PlanInput` / `PlanStep` changes (exact TS)

Additive only; existing D fields unchanged (`lib/optimizationPlanner.ts:12-39`).

```ts
export type EditMode = 'less' | 'normal' | 'expand';   // NEW - edit-intensity axis, orthogonal to StepFocus

export interface PlanStep {
  // ...all existing D fields unchanged (sectionId, index, headingText, html, focus,
  //    systemPrompt, guidelines, missingTerms, estimatedTokens, expectedLift, reason)...
  mode: EditMode;                 // NEW - which edit intensity this section gets
  userInstruction?: string;       // NEW - LESS's patch-only user message (OD-4);
                                  //       UNDEFINED for NORMAL/EXPAND -> endpoint uses today's literal (byte-for-byte)
}

export interface PlanInput {
  sections: Section[];
  guidelines: Guideline[];
  context: ArticleContext;
  budgetRemaining: number;
  seoScore: number;               // NEW - computeContentScore (contentScore.ts:386); 0..100; threaded from endpoint
  aiScore: number;                // NEW - computeAiSearchScore (aiSearchScore.ts:19); 0..100; threaded from endpoint
}
```

- A skip step keeps `mode: 'normal'` (irrelevant - no LLM), `userInstruction` undefined, `systemPrompt: ''` (as today).
- The planner stays PURE: `seoScore`/`aiScore` are INPUTS, computed/read in the endpoint, never fetched in the planner (D constraint).

---

## Data-flow (endpoint -> planner -> LLM)

```
optimize-sections POST { content, articleId, scoreData? }                    (optimize-sections.ts:72)
   |- verifyUser + assertArticleAccess + getOrgUsage5h hard-gate    [unchanged, :67-98]
   v
 splitSections(content) -> Section[]                                          (:122)
   |- sse 'meta'                                                              (:123)
   v
 ctx = buildArticleContext(articleId)   snapshot = ctx.coverage               (:126-127)
 guidelines = buildGuidelines(snapshot, ctx)                                  (:128)
   v
 seoScore = read content_score / scoreData._computed_score (contentScore.ts:386)    <- NEW read (server-side)
 aiScore  = read latest ai_visibility_runs.score (aiVisibilityStore.ts:14; [id]/index.ts:46-52)  <- NEW read
   v
 plan = buildOptimizationPlan({ sections, guidelines, context: ctx,
                                budgetRemaining, seoScore, aiScore })          (:132-133)  [PURE]
   |- aiTakeover = seoScore>=85 && seoScore-aiScore>25                         (pillar 5)
   |- per section: worthEditing -> skip | selectMode -> less|normal|expand
   |- systemPrompt: NORMAL/EXPAND = buildStepPrompt (byte-for-byte); LESS = LESS_RULES+focusBlock
   |- userInstruction: LESS set; NORMAL/EXPAND undefined
   v
 for step of plan.steps:                                                       (:142)
   |- focus==='skip' -> sse 'section' buildSectionEvent(section,result,step)   (:147-149)  changed:false + focus/mode/reason  [0 tokens]
   |- else -> DeepSeek: system=step.systemPrompt,                             (:164)
   |          user = step.userInstruction ?? "Improve this section:\n\n"+html  (:165)  <- endpoint edit (OD-4)
   |          retries/abort/stripFences/isUsableEdit/diff                      [unchanged, :152-186]
   |          sse 'section' buildSectionEvent(section,result,step)            (:188)  changed:true + focus/mode/reason
   v  finally: shouldChargeCredit -> recordAiTokens                            [unchanged, :190-195]
 sse 'done'                                                                    (:204)
```

The endpoint edits: (1) read `seoScore` + `aiScore` server-side and pass them into `buildOptimizationPlan`; (2) change the user-message line to `step.userInstruction ??` the existing `Improve this section` literal; (3) forward `focus`/`mode`/`reason` from `PlanStep` onto BOTH `section` SSE events via `buildSectionEvent(section, result, step)` (skip branch `:148`, changed branch `:188`) — the UX contract (Ratification 2). Everything else in the loop/finally/SSE is byte-for-byte D.

**`section` SSE event contract (UX sub-project dependency):** the existing `section` event gains three optional fields sourced verbatim from `PlanStep` — `focus: StepFocus`, `mode: EditMode`, `reason: string`. `buildSectionEvent` / `SectionEvent` (`lib/optimizeSectionEvents.ts`) must gain these optional fields. This is the ONLY consumer-facing contract the UX layer depends on (no score field); kept minimal + additive (Part-8-clean for the UX side).

---

## What F ships / touches / freezes

**Ships (new pure code in `lib/optimizationPlanner.ts`):** `EditMode` type; `PlanStep.mode` + `PlanStep.userInstruction`; `PlanInput.seoScore` + `PlanInput.aiScore`; named constants `LESS_MIN/NORMAL_MIN/SEO_HIGH/AI_GAP/INTENT_INTRO_MIN/TERM_WORTH_FLOOR`; `worthEditing`, `selectMode`, `introMayExpand`, `hasCriticalMiss`; `LESS_RULES` + `buildLessPrompt`; `buildStepPromptForMode`; `userInstructionForMode`.

**Touches (endpoint, minimal):** `pages/api/articles/optimize-sections.ts` - read `seoScore`/`aiScore`, pass into plan (`:133`); user-message line (`:165`); forward `focus`/`mode`/`reason` via `buildSectionEvent(section, result, step)` on BOTH `section` events (skip `:148`, changed `:188`); `legacyPlan` (`:48-65`) gets `mode: 'normal'`, `userInstruction: undefined` on each step + `seoScore/aiScore` are irrelevant to it (draft path stays byte-for-byte legacy). Plus `lib/optimizeSectionEvents.ts` — `buildSectionEvent`/`SectionEvent` gain optional `focus`/`mode`/`reason` fields (additive, UX contract).

**Frozen (do NOT edit):** `lib/optimizeGuidelineRouting.ts` (routing unchanged - F constrains MODE, not routing), `lib/recommendationEngine.ts`, `lib/aiCoverage.ts`, `lib/articleContext.ts`, `lib/contentScore.ts`, `lib/aiSearchScore.ts`. The existing `buildStepPrompt`/`SHARED_RULES`/`NEGATIVE_CONSTRAINTS`/`OUTPUT_RULE`/`focusBlock` (`optimizationPlanner.ts:138-175`) are REUSED unchanged by NORMAL/EXPAND - not modified.

---

## Testing (LOCAL jest.mock only; [[avoid-any-type]]; implementers must NOT run `npm run build`)

- **`worthEditing`** (pure): skip when `expectedLift < LESS_MIN`; keep at `>= LESS_MIN`; term-only section (`rgs=[]`, `secTerms>0`, `expectedLift=0`, `aiTakeover:false`) is WORTH editing → `true` (OD-2 [RATIFIED]); the same term-only section under `aiTakeover:true` → `false` (takeover drops terms); critical-miss overrides the threshold (never skipped).
- **`selectMode`** (pure): tier boundaries (5->skip via worthEditing, 6->less, 12->less, 13->normal); a term-only section (lift 0, passed via terms) -> `less`; `effort:'Large'` or critical-miss -> expand; intro index 0 -> less unless `introMayExpand`.
- **`introMayExpand`** (pure): true when intent bucket score < 50 OR `answersMainQuestionEarly === false`; false otherwise -> intro stays LESS.
- **AI-takeover** (pure, via `buildOptimizationPlan`): `seoScore=90, aiScore=40` -> `secTerms` dropped, no `seo-terms` focus, term-only sections skip (takeover suppresses the term path); `seoScore=90, aiScore=80` (gap 10 <= 25) -> NO takeover, term-only sections stay LESS.
- **LESS prompt/user-message:** `LESS_RULES` present, `SHARED_RULES` lines 145-146 ABSENT; `userInstruction` is the patch-only message (NOT "Improve this section"); intro-LESS adds the one-sentence-answer directive for index 0.
- **NORMAL byte-for-byte regression (the required test):** an all-NORMAL run (all `expectedLift > NORMAL_MIN`, no takeover, no intro-block) produces the EXACT `systemPrompt` from today's `buildStepPrompt` AND `userInstruction === undefined` for every step - assert the section events + prompts equal the pre-F baseline. Keep D's current 26 tests (`optimizeGuidelineRouting`/`optimizationPlanner`) + the endpoint guard suite green.
- **Endpoint** (extend `__tests__/api/articles-optimize-sections-guard.test.ts`, LOCAL mock of `buildArticleContext`/`getOrgUsage5h`/`fetch` + the two score reads): NORMAL step sends `Improve this section:\n\n` + html; LESS step sends `step.userInstruction`; skip emits `changed:false` with NO fetch.
- Implementers must NOT run `npm run build` (controller runs it once at the end).

---

## Task breakdown (detailed TDD plan: `docs/superpowers/plans/2026-07-01-auto-optimize-less-mode.md`)

1. Types + constants - `EditMode`, `PlanStep.mode`/`userInstruction`, `PlanInput.seoScore`/`aiScore`, the 6 named constants. `tsc` green with placeholders defaulting to NORMAL.
2. `hasCriticalMiss` + `worthEditing` (pure) - benefit threshold, critical override, term-only → worth (OD-2 [RATIFIED]; `aiTakeover` suppresses).
3. `introMayExpand` + `selectMode` (pure) - tiers, intro guard, expand gate (OD-5).
4. AI-takeover in `buildOptimizationPlan` - thread `seoScore`/`aiScore`, drop `secTerms` under takeover (pillar 5, OD-3).
5. `LESS_RULES` + `buildLessPrompt` + `buildStepPromptForMode` + `userInstructionForMode` - LESS system prompt & patch-only user message; intro-LESS one-sentence directive.
6. Wire `mode`/`systemPrompt`/`userInstruction` into `buildOptimizationPlan` step assembly (skip predicate becomes `!worthEditing`).
7. **All-NORMAL byte-for-byte regression test** - proves NORMAL systemPrompt + undefined userInstruction unchanged vs baseline.
8. Endpoint wiring - read `seoScore`/`aiScore` server-side, pass into plan, `user = step.userInstruction ??` today's literal; forward `focus`/`mode`/`reason` via `buildSectionEvent(section, result, step)` on BOTH `section` events (skip + changed) and add those optional fields to `buildSectionEvent`/`SectionEvent` in `lib/optimizeSectionEvents.ts` (UX contract, Ratification 2); `legacyPlan` steps get `mode:'normal'`; extend guard test.

~8 tasks. Effort: **Medium** - no routing/recommendation/coverage changes; all new logic is pure + additive; the endpoint edit is the two score reads + the user-message line + the additive `buildSectionEvent` field forwarding.

---

## Non-goals / deferred

- **E's `sectionMissingPoints`** - F deliberately uses the existing `expectedLift`/scores, not E. Once E ships a real per-section `sectionMissingPoints`, `worthEditing` can consume it as a strictly better deficit signal (replace/augment `expectedLift` in the gate) - a one-function follow-up behind the same `worthEditing` signature.
- **Routing changes** - the intent->intro magnet (`optimizeGuidelineRouting.ts:74-76`) is left intact; F neutralizes its harm via intro MODE protection, not by re-routing. A future sub-project may fix routing at the source.
- **Fractional/per-mode credit charging** - unchanged; `shouldChargeCredit` all-or-nothing stays.
- **Editing `SHARED_RULES` growth ratchets for NORMAL** - out of scope by construction (NORMAL is frozen byte-for-byte). Only LESS omits lines 145-146.

---

## [RATIFIED] Term-only → LESS (was CONFLICT)

**Term-only reclassification (OD-2 [RATIFIED]) vs "NORMAL byte-for-byte" (pillar 3):** Today a section whose only deficit is missing NLP terms (`rgs=[]`, `secTerms>0`) runs `focus:'seo-terms'` with today's NORMAL prompt (`optimizationPlanner.ts:78,92`). The tech-lead ratified: such a section is worth a **LESS (minimal) edit** — `TERM_WORTH_FLOOR = 1` makes `worthEditing` return `true`, and `selectMode` maps it to LESS (lift 0 falls through the NORMAL tier). It is dropped ONLY under the AI-search takeover (high SEO), where the `!aiTakeover` guard suppresses the term path. This is an intentional behaviour CHANGE for term-only sections (they move from today's NORMAL prompt to a minimal LESS patch — SurferSEO's "Less" still weaves missing terms minimally) and is therefore NOT "byte-for-byte NORMAL" for that class; the frozen-NORMAL guarantee holds for every section F classifies NORMAL. Follow-up: the per-section 70% term signal (`sectionMissingTerms`) is noisier than Surfer's article-level term model, so a future article-level term-targeting pass (E / CoverageGraph territory) is the better long-term signal — but v1 keeps the per-section signal driving the LESS edit.

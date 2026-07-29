# Precision Auto-Optimize v4 — Spec

**Status:** P0 implementation  
**Date:** 2026-07-28  
**Related:** [v3](./precision-auto-optimize-v3-spec.md), [architecture](./architecture-content-editor-flow-report.md)

## Philosophy

**AO does not owe an edit. AO owes non-regression.**

```
69/63/56 → 69/63/56  (no safe edit) = SUCCESS
69/63/56 → 71/65/58                 = SUCCESS
69/63/56 → 65/58/50                 = MUST BE IMPOSSIBLE TO ACCEPT
```

Same scorer as today (`scoreArticleHtml` + live AI). No LLM judge. Do not change `contentScore.ts` blend / pipeline v7.

## Dual score gates (MUST)

| Gate | Compare | Meaning |
|------|---------|---------|
| **Candidate** | TEMP vs WORKING | Is this edit good on the current working doc? |
| **Final** | FINAL (re-scored working.html) vs IMMUTABLE BASELINE | Did the whole run not regress the original? |

Candidate reject → discard temp only (working unchanged).  
Final fail → **full rollback** to original (byte-identical after `normalizeHtmlForDiff`).

## Snapshots

```
OriginalSnapshot (immutable) = HTML + scores + hash
WorkingSnapshot              = mutates only on candidate PASS
TempSnapshot                 = apply candidate + score
FinalSnapshot                = scoreArticleHtml(working.html) — never inherit last candidate scores
```

## Score types

```ts
type ScoreAvailability = 'available' | 'unavailable' | 'stale' | 'error'
type ScoreGateMode = 'strict_non_regression' | 'balanced' | 'weighted' // P0: only strict

type AoScores = { seo: number; content: number; ai: number }

type AoScoreDelta = {
  before: number | null
  after: number | null
  delta: number | null
  direction: 'up' | 'down' | 'unchanged' | 'unknown'
  availability: ScoreAvailability
}

type ScoreGateConfig = {
  mode: ScoreGateMode
  /** Noise floor — sub-threshold drops are not "meaningful regression" until variance study. */
  minMeaningfulDelta: number // default 2
}
```

**STRICT_NON_REGRESSION:** reject meaningful regressions (≥ minMeaningfulDelta). Sub-threshold (e.g. −1) = noise.

**Unavailable ≠ unchanged:** AI not scored yet → PENDING_AI → compute. AI error/unavailable under strict → REJECT/INCONCLUSIVE (never ACCEPT).

## Cost strategy (deterministic promising)

```
Safety → Invariant → Semantic
  → SEO + Content
  → if meaningful SEO/Content regression vs working → REJECT (no AI)
  → if SEO >= working AND Content >= working → score AI
  → Candidate Score Gate (full vs working)
```

## FAQ round (same gates)

Post-body FAQ append (`lib/ao/applyGatedFaq.ts`) is **not** exempt:

1. IntentGuard + length budget (`selectFaqQuestions`)
2. Candidate: TEMP (working+FAQ) vs WORKING — same score gates
3. Final: re-score(working) vs BASELINE — FAIL → **full rollback to original**

Never `mergeFaqHtml` without gates.

## Critical Content Map

Multi-candidate definitions (lead + definition-like H2 + pattern/topic score) — not only “first paragraph before H2”.  
Lead = semantic role (topic ID + direct answer), not byte-identical.

## Targeting

No `sections[0]` / WHOLE_ARTICLE as semantic fallback.  
No-confidence → skip.

## Pipeline

ORIGINAL → BASELINE → Intent → CriticalMap → Targeting → EditPlan  
→ WORKING  
→ for each candidate: TEMP → gates → Candidate Score (vs working) → accept/reject  
→ FINAL re-score(working) → Final Gate (vs baseline) → PASS emit diffs | FAIL rollback  

SSE section events: **final accepted working vs original only**.

## Acceptance

- May rewrite protected definition if semantic PASS; may not delete without equivalent  
- Candidate REJECT must not mutate working  
- Final rollback = normalized original HTML  
- Signed UI deltas; never Math.max(0) fake ↑  
- Golden: destroy fail, safe rewrite pass, final AI↓ rollback  

## v4.1 — Precision / Enrichment / Deep Optimize

Three **strategies** share one `runPrecisionOptimizeV4` engine (dual-gate unchanged):

| Strategy | Gate mode | Edit power |
|----------|-----------|------------|
| precision | `strict_non_regression` | Targeted (may substantial-rewrite weak AI sections) |
| enrichment | `aggressive` (SEO/AI drop ≤2) | Medium budgets / steps |
| deep_optimize | `aggressive` (SEO/AI drop ≤3) | Large budgets / steps |

Aggressiveness increases **edit power and structural freedom**, not semantic risk.  
**Final overall Content Score (blend) must never regress** vs ORIGINAL baseline.  
Candidate Gate compares TEMP vs CURRENT WORKING. Flat overall requires deterministically verified objective.  
Evaluate all sections; generate edit candidates only for justified weak/medium gaps.  
Budgets are ceilings — never word-count targets. FAQ only after recomputing remaining gaps.

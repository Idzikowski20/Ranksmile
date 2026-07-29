# Precision Auto-Optimize v3 — Spec

**Status:** P0 implementation target  
**Date:** 2026-07-28  
**Related:** [architecture-content-editor-flow-report.md](./architecture-content-editor-flow-report.md)

## Goal

Auto-Optimize is a **Precision Editor**, not Article Generator 2.0.

```
Primary:   Content Quality + Intent Satisfaction
Secondary: AI Coverage
Tertiary:  SEO Score
Constraint: Do not degrade original content / no topic drift
```

## Pipeline (P0)

```
ARTICLE → gaps → EditCandidate[] (WHAT/WHY)
  → IntentGuard #1
  → IntentProfile
  → EditPlanner → PlanStep[] (WHERE/HOW/HOW MUCH)
  → IntentGuard #2 (action fit)
  → EditBudget
  → Targeted LLM (operation X at place Y for gap Z)
  → EditSafetyGate (deterministic BEFORE/AFTER diff)
  → ACCEPT | REJECT(rejectReason)
  → MERGE → score
```

**Never** auto-fallback to whole-article rewrite on precision failure.

## Contracts

### EditCandidate (WHAT / WHY — no `action`)

| Field | Meaning |
|-------|---------|
| source | `seo_term` \| `ai_coverage` \| `paa` \| `visibility` \| `entity` |
| targetGap | What to cover |
| intentFit / topicDrift / commercialDrift / factualRisk | 0..1 |
| priority | critical \| recommended \| optional |

Term ≠ Topic. Entity ≠ Topic. PAA ≠ Topic. None alone opens a new H2.

### PlanStep (WHERE / HOW / HOW MUCH)

Planner chooses `action`: `expand_existing_paragraph` \| `insert_sentence` \| `enrich_heading` \| `add_faq` \| `skip`.  
Includes `maxNewWords`, `maxChangeRatio`, `allowedChanges`, `forbiddenChanges`.

### ArticleIntentProfile

Built from keyword + title + existing headings + article tokens + SERP/PAA clusters.  
Commercial denylist is a safety net, not the whole boundary.

### EditBudget / EditSafetyGate

Deterministic diff (not LLM self-report):

- maxNewWords / maxDeletedWords / maxModifiedParagraphs / **maxChangeRatio**
- no unexpected H2/H3 when `allowNewHeading: false`
- forbidden topics
- valid HTML

**RejectReason:** `WORD_BUDGET` \| `DELETE_BUDGET` \| `PARAGRAPH_BUDGET` \| `CHANGE_RATIO` \| `UNEXPECTED_HEADING` \| `TOPIC_DRIFT` \| `FORBIDDEN_TOPIC` \| `INVALID_HTML` \| `PRESERVATION`

### CoverageState

`missing` \| `mentioned` \| `partial` \| `adequate` \| `comprehensive`  

Presence live-check → at most `mentioned`/`partial` (quality cap 1–2).  
AO treats as covered only when ≥ `adequate` (quality ≥ 3 from judge).

### FAQ

Length-based budget: &lt;800→2, 800–1500→3, 1500–2500→4, 2500+→5.  
Only after IntentGuard + unanswered + non-redundant.

### No-op (P0 safety)

SEO ≥ TARGET_SEO **and** AI ≥ TARGET_AI → zero LLM (`already_optimized`).  
**Not** final quality-based stopping (P1).

## Modes (product)

1. Precision SEO — SEO weak  
2. AI Coverage — SEO ready, AI weak  
3. Intent Repair — weak upfront answer  
4. Quality Repair / no-op — targets met  

## Strategy flag

`optimizationStrategy: 'precision' | 'whole_article_fallback'`  
Fallback only via controlled feature flag / admin / test — never automatic.

## Golden Set (acceptance)

**Cuckolding / zespół prowokowanej zdrady**

MUST NOT: detective services, loyalty testers, commercial investigation drift, invent psych diagnoses.  
MUST: improve definition / relevant on-intent questions carefully.  
Assert: commercialDrift ≈ 0, topicDrift ≈ 0. Score↑ alone is insufficient if human quality↓.

## Out of P0

Independent Quality Judge, full YMYL LLM mode, advanced SERP clustering, quality-based stop, changes to `contentScore.ts` / 55–45 blend / pipeline v7.

## Code map

| Module | Role |
|--------|------|
| `lib/ao/editCandidate.ts` | Candidates |
| `lib/ao/intentProfile.ts` | Profile |
| `lib/ao/intentGuard.ts` | Guard #1 / #2 |
| `lib/ao/editPlan.ts` | PlanStep builder |
| `lib/ao/editBudget.ts` | Budgets |
| `lib/ao/editSafetyGate.ts` | Post-LLM gate |
| `lib/ao/coverageState.ts` | CoverageState |
| `lib/ao/runPrecisionOptimize.ts` | Orchestration |
| `pages/api/articles/optimize-sections.ts` | Default precision path |
| `lib/aoFaqSection.ts` | FAQ gate |
| `lib/liveCoverage.ts` | Presence quality caps |
| `lib/optimizeMode.ts` | Hard no-op |

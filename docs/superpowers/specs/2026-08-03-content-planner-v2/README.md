# Content Planner v2 — Content Operating System

**Date:** 2026-08-03  
**Code:** `lib/contentPlanner/`  
**Status:** Implementation (Planner First / PR1)

## Żelazna zasada

**Write Engine nigdy nie podejmuje decyzji architektonicznych.**  
Struktura, kolejność, budżet, coverage, priorytety i narracja zapadają wyłącznie w **Plannerze**. Writer realizuje **`ArticleExecutionPlan`**. Plan Validator ocenia zgodność z planem **przed** write; post-write conformity sprawdza H2 ⊆ plan.

```
Deep analysis → Content Planner → Plan Validator → ArticleExecutionPlan (immutable + plan_hash)
                                                      ↓
                                              Write Engine (executor only)
```

| Rola | Odpowiedzialność |
|------|------------------|
| **Planner** | Intent, blueprint, outline, briefs, budgets, Quick Answer LLM, coverage |
| **Plan Validator** | Benchmark hard gate + Knowledge Coverage ≥95% + assignment/budget gates |
| **Write Engine** | Egzekwuje Execution Plan (PR1: Python monolith; PR2: Section Writer) |
| **Post-write Validator** | Conformity (H2 set), claim/question/SEO |

Nie: „Planner → Python interpretuje / wymyśla outline”.  
Tak: „Planner → Execution Plan → Writer wykonuje”.

## Model LLM — bez swapu w PR1/PR2

**Nie zmieniamy modelu Write Engine** w tym wdrożeniu. Luką był brak Execution Plan między SERP a modelem, nie sam model. Ślepy benchmark modeli (DeepSeek vs Claude vs GPT vs Gemini) dopiero **Etap 3**, na **identycznym** `ArticleExecutionPlan`.

## Goal

Pre-write planning with compiler gates so the LLM never writes until Blueprint / Outline / Briefs / Execution Plan satisfy competitor-calibrated budgets and knowledge quotas. Post-write: Flow + Claim + Question + SEO → Rewrite Planner → Knowledge Completion Engine → CCM compile.

## Pipeline

Intent → Reader → Competitor + AI → Knowledge Intelligence → Target KG → Benchmark → Budget → Blueprint → Outline loop (+ benchmark improve) → Brief loop → **Quick Answer LLM** → **Plan Validator** (Benchmark + Knowledge Coverage ≥95%) → **`ArticleExecutionPlan`** → Write → Assembler → Flow/Claim/Question/SEO/Conformity → Rewrite Plan → KCE → CCM.

## Hard gates (Plan Validator)

### Competitor Benchmark

Plan must meet (not undercut) `CompetitorBenchmark`:

| Field | Rule |
|-------|------|
| `targetWords` | `article_budget.words` ≥ benchmark |
| `targetH2` | `outline.sections.length` ≥ benchmark H2 |
| paragraphs / lists / tables / FAQ / examples / claims / questions | planned quotas ≥ recommended (claims/questions capped by KG size) |

Example: benchmark 3650 words, plan 2100 → **FAIL** `below_competitor_benchmark` → improve loop → Writer never gets a thin plan.

### Knowledge Coverage ≥ 95%

```
criticalClaims %, questions %, evidenceNeeds % → knowledgeCoveragePct = min(...)
Gate: knowledgeCoveragePct >= 95
```

## Contracts

Canonical TypeScript contracts live in [`lib/contentPlanner/types.ts`](../../../lib/contentPlanner/types.ts).

Key types:

| Type | Role |
|------|------|
| `IntentBlueprint` | Search intent, article type, brand≠intent gate |
| `ReaderModel` | Persona (beginner DIY, fears, CTA) |
| `CompetitorProfile` | Per-URL structural + knowledge metrics |
| `CompetitorSynthesisMetrics` | TOP-N aggregates (words, H2, lists, …) |
| `CompetitorBenchmark` | Targets to beat (+ floors) |
| `TargetClaim` / `TargetQuestion` | Pre-write knowledge units |
| `ArticleBudget` / `SectionBudget` | Global + per-H2 quotas (coverage budget) |
| `ArticleBlueprint` | Dynamic targets from Benchmark + Priority |
| `AdaptiveOutline` / `OutlineSection` | H2 plan + assigned claims/blocks |
| `SectionBrief` | Writer input (`mustAnswer`, `sectionPriority`, `writerHints`) |
| `KnowledgeCoverageReport` | Coverage % diagnostics |
| **`ArticleExecutionPlan`** | Immutable Write Engine contract + `planHash` |
| `ValidationResult` | Gate pass/fail + diagnostics |
| `RewritePlan` | Ordered repair steps for KCE |
| `ContentPlannerBundle` | Persistable planning snapshot (`schemaVersion: 2`) |

Sidecar payload field: **`execution_plan`** (snake_case via `toSidecarExecutionPlan`).

## Planning loop limits

- `MAX_OUTLINE_IMPROVE_ITERS = 3`
- `MAX_BRIEF_IMPROVE_ITERS = 3`
- On escalate: `canWrite: false` → generate returns **422** (Write Engine not started).

## Generate wire

`POST /api/articles/[id]/generate`:

1. `runContentPlanner` → structure + coverage  
2. `finalizePlannerForWrite` (Quick Answer LLM + Plan Validator + `buildArticleExecutionPlan`)  
3. Persist `score_data.content_planner_v2`  
4. If `!canWrite` → **422** `plan_validation_failed`  
5. Else kickoff sidecar with `execution_plan`

Python `run_pipeline`: when `execution_plan` present → **no outline LLM**; execute plan; review **intra-section only**; conformity check H2 ⊆ plan.

## Boundaries

- Does **not** replace CCM SoT — Target KG is pre-write; CCM compiles after HTML exists.
- Does **not** dump competitor HTML into Writer — only Execution Plan sections + claims.
- Brand DNA may color examples/CTA only when `IntentBlueprint.allowBrandNiche === true`.
- **PR2:** Section Writer (same contracts, same model).  
- **Etap 3:** blind model benchmark on identical Execution Plan — only then consider model swap.

## Tests

- `__tests__/lib/contentPlanner/` — engines + gates + Execution Plan  
- `__tests__/lib/contentPlanner/executionPlan.test.ts` — Benchmark fail, coverage %, plan_hash, finalize  
- `python-sidecar/tests/test_execution_plan.py` — plan formatting + conformity helpers

## Package layout

| Path | Role |
|------|------|
| `lib/contentPlanner/types.ts` | Contracts |
| `lib/contentPlanner/intentBlueprint.ts` / `readerModel.ts` | Intent + persona |
| `lib/contentPlanner/competitorIntelligence.ts` / `competitorBenchmark.ts` | Profiles → synthesis → benchmark |
| `lib/contentPlanner/knowledgeIntelligence.ts` | Target KG + gain/priority |
| `lib/contentPlanner/budgetEngine.ts` | Budget + Article Blueprint |
| `lib/contentPlanner/outlineBuilder.ts` / `planningLoop.ts` | Outline/brief loops + benchmark improve |
| `lib/contentPlanner/knowledgeCoverage.ts` | Coverage % |
| `lib/contentPlanner/quickAnswer.ts` | Quick Answer LLM |
| `lib/contentPlanner/executionPlan.ts` | `ArticleExecutionPlan` + sidecar projection |
| `lib/contentPlanner/sectionWriter.ts` | Memory, assembler, stub writer (PR2) |
| `lib/contentPlanner/knowledgeCompletion.ts` | Rewrite Planner + KCE |
| `lib/contentPlanner/validators/*` | Plan + post-write gates |
| `lib/contentPlanner/runContentPlanner.ts` | Orchestrator + `finalizePlannerForWrite` |
| `lib/contentPlanner/fromArticleInputs.ts` | score_data adapters |
| `pages/api/articles/[id]/content-plan.ts` | GET/POST API |
| `pages/api/articles/[id]/generate.ts` | Planner First generate |

## API

`POST /api/articles/[id]/content-plan` — `{ produceArticle?, persist? }` → runs planner, stores `score_data.content_planner_v2`.  
`GET` — returns persisted bundle.  
`POST /api/articles/[id]/generate` — Planner → Validator → `execution_plan` → sidecar (422 if fail).  
WIE `formatWieWriteBlocks` injects planner prompt when `content_planner_v2.bundle` is present.

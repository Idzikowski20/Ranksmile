# 06 — Consumers & Projections

Uniform contract: **`12-consumer-contracts.md`** (`accept(context)`).  
Graph access: **`19-graph-query.md`** only.  
Actions: **`11-action-graph.md`** + **`20-recommendation-dsl.md`**.

## Coverage Projection

Named projection (not Engine). Checklist / % from CCM via GraphQuery.

**Code:** `lib/projections/coverageView.ts` → `projectCoverage(model)`.

## Visibility Projection

```text
Atomic Facts → Cluster → Confidence → Completeness → VisibilityProjection
```

**Code:** `lib/projections/visibilityView.ts` → `projectVisibility(model)`.

## Planner (stateless)

`PlannerInput` → `Plan` → `PlannerRun` event → done. Budget + strategy. See `11`.

## Judge

ModelDiff derived; expectations from Recommendation DSL verified when present.

**Code:** `lib/intelligence/` — `diffModels`, `judgeModels`.

## Benchmark — Subgraph Matching

`graphQuery.findSubgraph(pattern)` → gaps → DSL recommendations. Never HTML when CCM available.

**Code:** `lib/intelligence/benchmark.ts` — `runBenchmark` / `benchmarkConsumer`.

## ConsumerContext

**Code:** `lib/intelligence/consumerContext.ts` + `consumers.ts` (`accept(context)`).  
Planner: `lib/planner/planActions.ts` → `plannerConsumer`.  
History MVP: `lib/intelligence/compileStore.ts` → `InMemoryCompileStore`.

## Intelligence consumers (split)

Do **not** overload a single “WIE” blob forever. Three meta/analysis lanes:

| Lane | Id | Role |
|------|-----|------|
| **Writing Intelligence** | `writing_intelligence` | Craft quality: clarity, flow, presentation slice, style |
| **Editorial Intelligence** | `editorial_intelligence` | Policy, EEAT, opening, publish readiness, brand voice |
| **Optimization Intelligence** | `optimization_intelligence` | Score/Visibility deltas, ActionGraph efficacy, AO outcome |

**Code:** `lib/intelligence/writingIntelligence.ts`.  
**Persistence:** `CompileStore` + `InMemoryCompileStore` + `SqlCompileStore` (`cia_ccm_snapshots` / `cia_compile_events` via `ensureCcmTables`).

**Runtime facade:** `lib/intelligence/runtimeApi.ts` → `compileArticle` / `getCcm` / `projectArticleIntelligence` (Surfer-like: facts + terms + coverage/visibility/WI).  
**HTTP:** `/api/articles/[id]/ccm` (+ `/live`). Editor UI unchanged — CCM is backend-only for now.

Each implements `accept(ConsumerContext)`. They may read `peerResults` but must not re-extract knowledge. Product UI may still show one “WIE” panel that composes the three.

## History

CompileEvents + Replay (`14`).

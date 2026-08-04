# 07 — Runtime

## Compile triggers

| Trigger | Mode |
|---------|------|
| Deep Analysis | `full` |
| Publish gate | `full` if stale |
| After AO | `incremental` or `full` |
| Editor save (PUT) | `full` if stale (`compileIfStale`, fire-and-forget) |
| Editor debounce | `incremental` via dependency graph (API `/ccm/live` overlay) |
| Cron | `full` via `compileIfStale` batch (`/api/cron/ccm-compile`) |

## Dependency Graph vs Invalidation Graph

**Dependency Graph** — structural links (what *could* be affected):

```ts
export interface CompileDependencyGraph {
  readonly blockToFactIds: Readonly<Record<string, readonly string[]>>;
  readonly factToIntentIds: Readonly<Record<string, readonly string[]>>;
  readonly intentToQuestionIds: Readonly<Record<string, readonly string[]>>;
  readonly factToEvidenceIds: Readonly<Record<string, readonly string[]>>;
  readonly blockToIrClaimIds: Readonly<Record<string, readonly string[]>>;
}
```

**Invalidation Graph** — what *must* be recomputed for this edit (narrower):

```ts
export interface InvalidationGraph {
  readonly dirtyBlockIds: readonly string[];
  readonly dirtyCandidateIds: readonly string[];
  readonly dirtyNodeIds: readonly string[];
  readonly dirtyPassIds: readonly string[];     // PassManager passes to re-run
  readonly dirtyProjectionIds: readonly string[]; // coverage/visibility/action_graph
}
```

```text
Paragraph 14 dirty
  → Dependency Graph closure (candidate set)
  → Invalidation Graph (not every linked Intent is dirty — e.g. untouched supported facts)
  → PassManager.run(enabled = dirtyPassIds)
  → new CCM Snapshot vN+1
```

Rule: **dirty block ⇏ dirty intent** automatically. Intent invalidates only if supporting facts/candidates in the closure change status or membership.

## Live presence

Cheap status flips on anchors; no new IR candidates.

**Code:** `lib/intelligence/livePresence.ts` → `applyLivePresence(model, plainText)`.  
**HTTP:** `POST /api/articles/[id]/ccm/live` (overlay, **no persist**).  
**UI:** none — call from jobs/tools only until product opt-in.

## Capabilities-aware notify

```text
persist CCM → emit CompileFinished → rebuild ActionGraph if capabilities.planner
           → notify consumers with ConsumerContext
```

## Caching

Key includes `deterministicHash` inputs (contentHash, rules, prompts, profile, irVersion).

## API

```ts
compileArticle(opts): Promise<CompileArticleResult>  // lib/intelligence/runtimeApi.ts
getCcm(articleId, store): Promise<CanonicalContentModel | null>
projectArticleIntelligence(model): ArticleIntelligenceView  // Surfer-like DTO
diffModels(a, b): ModelDiff
buildActionGraph(model): ActionGraph
getDependencyGraph(model): CompileDependencyGraph
projectCoverage(model): CoverageView
projectVisibility(model): VisibilityProjection
appendEvent(event: CompileEvent): void  // via CompileStore / history consumer
```

**HTTP:** `GET|POST /api/articles/[id]/ccm` (SqlCompileStore); `POST …/ccm/live` (overlay).  
**UI:** none in editor — CCM is backend-only until product surfaces it; debug-export may include `ccm` slice.  
**Info to cover (OQ-8):** `buildInfoToCoverFromCcm` / `view.infoToCover` on API DTO; `projectCcmToCoverageSnapshot` writes `ai_info_to_cover` after product compile (Etap 27). Editor labels unchanged — no CCM widgets.  
**Fact Engine v2:** `applyDaFactEnrichment` merges latest `ai_visibility_citations` into CCM before projection (Etap 28).  
**Hardening:** `ccmCompileMetrics` + DA **awaits** compile/projection so SSE `done` carries CCM SoT; `contradicts` heuristic (Etap 29).  
**Fact Engine v3:** `locateGapEvidenceWithLlm` quotes only — bumps weak/missing facts (Etap 30).  
**Recommendations:** `summarizeRecommendations` → `view.recommendations` on API DTO only.  
**Product triggers:** `compileAfterArticleChange` after Deep Analysis + post-generate; after AO (`optimize-sections`); `compileIfStale` on publish gate + article PUT save; cron `ccm-compile` every 6h.  
**AO wire:** `loadCcmEditCandidatesForArticle` → `extraCandidates` in Precision AO (live presence + ActionGraph).  
**Gold parity:** `__tests__/lib/intelligence/runtimeApi.test.ts` (CIAS-001 Surfer statements → FactNode.statement).

## Budgets

| Mode | p95 target |
|------|------------|
| live presence | < 50ms |
| incremental (dep-closed) | < 3s |
| full | < 30s typical |
| embeddings | async |

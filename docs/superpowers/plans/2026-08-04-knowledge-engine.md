# Content Intelligence Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wdrożyć **Content Intelligence Engine** (CIE): rozdzielić **Benchmark Intelligence** (ile / jaka struktura) od **Knowledge Intelligence** (co napisać), zbudować **immutable** Knowledge Graph przed Plannerem, dodać Verifier + Planner Improve Loop + Narrative Optimizer, oraz Evidence/Provenance UI.

**Architecture:**

```
TOP-N (+ Official / PAA / AI Overview)
        ├─→ Benchmark Intelligence  →  PlannerTargets (median/p25/p75/min/max)
        └─→ Knowledge Intelligence Engine
              Extract → Normalize → Canonicalize → Vote → Cluster → Build Graph
              → Knowledge Verifier
              → knowledge_graph (IMMUTABLE after build)
        ↓
   Planner (+ Narrative Optimizer + Planner Validator/Improve Loop)
        ↓
   Execution Plan (per-section claims + section.reason)  ← only mutable plan artifact
        ↓
   Writer → Coverage (shared EmbeddingProvider) → AO patches NEW Execution Plan (never Graph)
        ↓
   UI Knowledge Coverage + Source Explorer
```

**Product name:** Content Intelligence Engine (CIE).  
**Module split:** `lib/benchmarkIntelligence/*` (struktura) + `lib/knowledgeEngine/*` (wiedza). Nie mieszać claims z word-count targets.

**Tech Stack:** TypeScript strict (no `any`), Jest, Serper/outlines cache, `EmbeddingProvider` (Hash MVP), Content Planner v2, Python Write Engine, Koala UI.

**Spec:** [`docs/superpowers/specs/2026-08-04-knowledge-engine/README.md`](../specs/2026-08-04-knowledge-engine/README.md)

---

## Locked decisions (cumulative)

| Topic | Decision |
|-------|----------|
| Knowledge vs Benchmark | **Osobne moduły** — KG = *co*; Benchmark = *ile / struktura* |
| KG mutability | **Immutable** po `buildGraph` + Verifier pass. AO/Writer/Coverage/Planner **nie** mutują grafu |
| AO | Patch **Execution Plan** → rewrite → HTML; nigdy edit Graph |
| Similarity | Jedna `semanticMatch` + `EmbeddingProvider` (Hash MVP) |
| Source weight | Tiers Official→PAA |
| dependsOn | Out of scope |
| Fallback | claims &lt; 30 lub verifier fail → legacy + warning; never block generate |
| Flag | `USE_KNOWLEDGE_ENGINE` (CIE) |
| Benchmark stats | **median + p25 + p75 + min + max** (średnia tylko diagnostyka) |
| Importance | Heuristic label **plus** `importanceScore: 0–100` (learning hook) |
| Narrative | Topic Blocks → **Narrative Optimizer** → Outline (nie sama frekwencja H2) |
| Planner quality | Osobny **Planner Validator + Improve Loop** (≠ Knowledge Verifier) |
| Explainability | `ExecutionPlanSection.reason` |
| Claim quality | `sourceDiversity` (official/competitors/ai_overview/paa flags + score) |

---

## PR split

- **PR-A** Tasks 1–10 — Benchmark Intelligence + Knowledge pipeline + Verifier + immutable graph + metrics  
- **PR-B** Tasks 11–14 — flag/fallback; Narrative Optimizer; Planner Validator loop; section claims + reason; brand gate  
- **PR-C** Tasks 15–16 — coverage (shared match) + AO **new** Execution Plan patch  
- **PR-D** Task 17 — Knowledge Coverage UI + rich Source Explorer  

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/benchmarkIntelligence/types.ts` | `DistributionStats`, `StructuralBenchmark`, `PlannerTargets` |
| `lib/benchmarkIntelligence/distributions.ts` | median/p25/p75/min/max helpers |
| `lib/benchmarkIntelligence/buildBenchmark.ts` | TOP-N → StructuralBenchmark (words, h2, faq, tables, lists, images, examples, citations, section/intro/paragraph length) |
| `lib/benchmarkIntelligence/toPlannerTargets.ts` | Benchmark → targets (prefer median/p75 floors) |
| `lib/knowledgeEngine/types.ts` | CanonicalClaim (+ importanceScore, sourceDiversity, generatedFrom, consensusExplanation), immutable KnowledgeGraph |
| `lib/knowledgeEngine/embeddingProvider.ts` | EmbeddingProvider + HashEmbedProvider |
| `lib/knowledgeEngine/semanticMatch.ts` | shared similarity |
| `lib/knowledgeEngine/sourceWeight.ts` | tiers |
| `lib/knowledgeEngine/competitorDocument.ts` | CompetitorDocument model |
| `lib/knowledgeEngine/extract.ts` … `buildGraph.ts` | stages; `Object.freeze` / readonly deep |
| `lib/knowledgeEngine/verify.ts` | Knowledge Verifier |
| `lib/knowledgeEngine/runKnowledgeEngine.ts` | KE only (does **not** compute word targets) |
| `lib/contentPlanner/narrativeOptimizer.ts` | Topic Blocks + intent → ordered outline seeds (action-first when step-by-step) |
| `lib/contentPlanner/plannerValidator.ts` | critical claims assigned, H2 vs benchmark, empty sections, claim-cap/section, FAQ↔PAA |
| `lib/contentPlanner/planningLoop.ts` | Improve loop uses plannerValidator |
| `lib/contentPlanner/executionPlan.ts` | `reason` per section; section-scoped claims |
| `lib/knowledgeEngine/coverage.ts` | claim coverage via semanticMatch; writes coverage **report** (not into frozen graph — side report / plan annotations) |
| `lib/knowledgeEngine/aoPlanPatch.ts` | missing claims → **new** Execution Plan revision |
| UI | Source Explorer Official/TOP1/TOP2/AI Overview + Used by N/10 |
| Tests | `__tests__/lib/benchmarkIntelligence/*`, `__tests__/lib/knowledgeEngine/*`, planner tests |

**Coverage vs immutability:** Coverage wyniki żyją w `score_data.knowledge_coverage_report` / claim status na Execution Plan / osobnym mutable overlay — **nie** w zamrożonym `knowledge_graph.claims[].coverage` jako source of truth. Opcjonalnie mirror w overlay dla UI.

Env: `USE_KNOWLEDGE_ENGINE=false` default.

---

### Task 1: Types — CIE naming + Benchmark + Knowledge (immutable)

**Files:**
- Update: `docs/superpowers/specs/2026-08-04-knowledge-engine/README.md` (rename CIE; two pillars)
- Create: `lib/benchmarkIntelligence/types.ts`, `lib/knowledgeEngine/types.ts`, constants
- Test: `__tests__/lib/knowledgeEngine/types.smoke.test.ts`

- [ ] **Step 1: Failing smoke — DistributionStats + CanonicalClaim fields**

```ts
import type { DistributionStats } from '../../../lib/benchmarkIntelligence/types';
import type { CanonicalClaim, KnowledgeGraph } from '../../../lib/knowledgeEngine';
import { KNOWLEDGE_SCHEMA_VERSION, PLANNER_CLAIMS_FLOOR } from '../../../lib/knowledgeEngine';

it('DistributionStats has percentiles', () => {
  const d: DistributionStats = { median: 3600, p25: 3100, p75: 3900, min: 2100, max: 4800, mean: 3620, n: 10 };
  expect(d.median).toBe(3600);
});

it('claim has importanceScore + sourceDiversity; no dependsOn', () => {
  const c: CanonicalClaim = {
    id: 'CLAIM_1',
    statement: '…',
    cluster: 'Technical SEO',
    importance: 'critical',
    importanceScore: 92,
    consensus: 0.94,
    evidence: [],
    usedByCompetitors: 9,
    competitorsTotal: 10,
    usedInSections: [],
    generatedFrom: ['serp', 'official'],
    sourceDiversity: { official: true, competitors: true, aiOverview: true, paa: false, score: 0.75 },
    consensusExplanation: { percent: 94, because: ['TOP1', 'TOP2', 'Official'] },
  };
  expect(c.importanceScore).toBe(92);
  expect(PLANNER_CLAIMS_FLOOR).toBe(30);
  expect(KNOWLEDGE_SCHEMA_VERSION).toBe(1);
});
```

- [ ] **Step 2: FAIL then implement types**

`KnowledgeGraph` marked conceptually immutable: TypeScript `Readonly<>` on arrays/objects; `buildGraph` returns `Object.freeze` shallow + freeze claims array.

- [ ] **Step 3: PASS**

---

### Task 2: Benchmark Intelligence — distributions + build

**Files:**
- Create: `lib/benchmarkIntelligence/distributions.ts`
- Create: `lib/benchmarkIntelligence/buildBenchmark.ts`
- Create: `lib/benchmarkIntelligence/toPlannerTargets.ts`
- Create: `lib/benchmarkIntelligence/index.ts`
- Test: `__tests__/lib/benchmarkIntelligence/benchmark.test.ts`
- Refactor later: `lib/contentPlanner/competitorBenchmark.ts` can call into this (or thin wrap)

- [ ] **Step 1: Test percentiles**

```ts
it('uses median not mean when outlier present', () => {
  const b = buildStructuralBenchmark([
    { wordCount: 3000, h2: 14, faq: 6, tables: 1, lists: 10, images: 3, examples: 4, citations: 10, sectionLens: [200], introLen: 80, paragraphLens: [40, 45] },
    { wordCount: 3200, h2: 15, faq: 7, tables: 2, lists: 11, images: 3, examples: 5, citations: 12, sectionLens: [220], introLen: 90, paragraphLens: [42] },
    { wordCount: 9000, h2: 40, faq: 20, tables: 8, lists: 40, images: 20, examples: 30, citations: 50, sectionLens: [800], introLen: 200, paragraphLens: [100] }, // outlier
  ]);
  expect(b.words.median).toBeLessThan(4000);
  expect(b.words.mean).toBeGreaterThan(b.words.median);
  expect(b.words.p25).toBeLessThanOrEqual(b.words.median);
  expect(b.words.p75).toBeGreaterThanOrEqual(b.words.median);
});
```

- [ ] **Step 2: `toPlannerTargets` prefers median (and p75 soft ceiling); floors from existing BENCHMARK_* constants**

- [ ] **Step 3: Persist `score_data.structural_benchmark` separately from `knowledge_graph`**

- [ ] **Step 4: PASS**

---

### Task 3: EmbeddingProvider + semanticMatch

*(unchanged intent from prior plan — Hash MVP, shared match)*

**Files:** `embeddingProvider.ts`, `semanticMatch.ts`  
**Test:** positive near-dup + negative unrelated  

- [ ] Steps: FAIL → implement → PASS  

---

### Task 4: Source tiers

**Files:** `sourceWeight.ts`  
**Test:** Official 1.0 … PAA 0.6  

- [ ] Steps: FAIL → implement → PASS  

---

### Task 5: CompetitorDocument

**Files:** `competitorDocument.ts`  
**Test:** headings from outlines cache  

- [ ] Steps: FAIL → implement → PASS  

---

### Task 6: Extract + Normalize

**Files:** `extract.ts`, `normalize.ts`  
**Test:** drop cities; keep GSC  

- [ ] Steps: FAIL → implement → PASS  

---

### Task 7: Canonicalize (pos + neg) + importanceScore + sourceDiversity stub

**Files:** `canonicalize.ts`  
**Test:** near-dup merge; SSL vs internal links do not merge; set `importanceScore` heuristic 0–100  

- [ ] Steps: FAIL → implement via `semanticMatch` only → PASS  

---

### Task 8: Vote + consensusExplanation + sourceDiversity finalize

**Files:** `vote.ts`  
**Test:** weak-only &lt; 0.75; diversity score rises with official+competitor+ai  

- [ ] Steps: FAIL → implement → PASS  

---

### Task 9: Topic Blocks + gaps (roles)

**Files:** `cluster.ts`, `gaps.ts`  
**Test:** keyword variants → ACTION block; consensus + opportunity gaps  

- [ ] Steps: FAIL → implement → PASS  

---

### Task 10: buildGraph (freeze) + Verifier + runKnowledgeEngine + timings

**Files:** `buildGraph.ts`, `verify.ts`, `runKnowledgeEngine.ts`  
**Test:** freeze throws on mutate attempt in strict mode / Object.isFrozen; verifier rejects no-evidence; timings keys present; degenerate no-throw  

- [ ] **Step 1: `buildGraph` returns frozen graph; mutating `graph.claims.push` throws or is no-op with freeze**

- [ ] **Step 2: Verifier — empty blocks, no evidence, NaN consensus, duplicate ids**

- [ ] **Step 3: Orchestrator returns `{ graph, verifier, stageTimingsMs }` — does not call Benchmark Intelligence**

- [ ] **Step 4: Soft timing assert fixture &lt; 2s offline**

- [x] **Step 5: PR-A suite PASS**

Run: `npx jest __tests__/lib/benchmarkIntelligence __tests__/lib/knowledgeEngine --no-coverage`

---

### Task 11: Feature flag + fallback in generate

**Files:** `generate.ts`, `.env.example`, gate helper  
**Test:** flag off / below floor / verifier fail → legacy; never hard-fail generate for empty KE  

- [x] Order in generate:

```ts
const benchmark = buildStructuralBenchmark(docs);
const targets = toPlannerTargets(benchmark);
const { graph, verifier } = await runKnowledgeEngine(...);
const gate = shouldUseKnowledgePlanner(graph, verifier, flag);
// persist structural_benchmark + knowledge_graph (immutable snapshot)
if (gate.use) runContentPlanner({ knowledgeGraph: graph, plannerTargets: targets, ... });
else runContentPlanner({ /* legacy */ }); // + warning
```

---

### Task 12: Narrative Optimizer

**Files:** Create `lib/contentPlanner/narrativeOptimizer.ts`  
**Test:** `__tests__/lib/contentPlanner/narrativeOptimizer.test.ts`

- [ ] **Step 1:** Input Topic Blocks + IntentBlueprint → ordered section seeds  

For `step-by-step` / beginner: prefer Quick Answer → action path (7-day / quick wins if present in blocks or glue) → foundation → action blocks → monitoring → advanced → FAQ/Summary — **not** raw frequency order of competitor H2s.

- [ ] **Step 2:** When blocks &lt; 5, allow template fillers; when ≥ 5, **no** primary EN course template (`Keywords and intent` as forced English labels)

- [ ] **Step 3: PASS**

---

### Task 13: Planner Validator + Improve Loop

**Files:** `plannerValidator.ts`; wire `planningLoop.ts`  
**Test:** critical claim unassigned fails; H2 below benchmark.median fails; section with &gt;8 claims fails; empty section fails; FAQ without PAA coverage soft-fail  

- [ ] **Step 1: `validatePlannerPlan({ outline, briefs, targets, graph })`**

- [ ] **Step 2: Improve loop max 3 — reassign claims / split overloaded sections / bump H2 from blocks**

- [ ] **Step 3: Distinct from Knowledge Verifier (graph schema vs plan quality)**

- [ ] **Step 4: Emit `plannerMetrics`**

- [ ] **Step 5: PASS**

---

### Task 14: Execution Plan — section claims + reason + brand gate + full targets

**Files:** `executionPlan.ts`, outline assignment, Python, `generate.ts`  
**Test:** sectionClaims + reason shape  

- [ ] **Step 1: Each section ≤ 8 claims**

- [ ] **Step 2: `reason` string/object e.g.**

```ts
reason: {
  summary: 'High consensus link-building block',
  signals: ['9/10 competitors', 'Official docs', 'PAA'],
}
```

- [ ] **Step 3: Brand gate empty brand_knowledge when niche off**

- [ ] **Step 4: Blueprint from `PlannerTargets` (median-based), not ad-hoc averages only**

- [ ] **Step 5: PASS**

---

### Task 15: Claim coverage via semanticMatch (overlay, not mutate graph)

**Files:** `coverage.ts`  
**Test:** paraphrase → covered/partial; unrelated → missing; writes `knowledge_coverage_report`  

- [ ] **Step 1: Never assign into frozen graph claims**

- [ ] **Step 2: Writer metrics**

- [x] **Step 3: PASS**

---

### Task 16: AO → new Execution Plan revision

**Files:** `aoPlanPatch.ts` + optimize wire  
**Test:** patch produces new plan object; graph reference unchanged / still frozen  

- [x] **Step 1: Input missing/partial from coverage report**

- [x] **Step 2: Output `{ previousPlanHash, newPlan }`**

- [x] **Step 3: PASS**

---

### Task 17: UI Knowledge Coverage + Source Explorer

**Files:** editor facts/coverage panel  

- [x] **Step 1: Rename → Knowledge Coverage**

- [x] **Step 2: Cluster collapses**

- [x] **Step 3: Source Explorer row order: Official ★★★★★ → TOP1 → TOP2 → … → AI Overview; footer `Used by 9/10 competitors`; show `sourceDiversity` chips**

- [x] **Step 4: Manual smoke**

---

## Self-review

| Requirement | Task |
|-------------|------|
| Benchmark Intelligence separate | 1–2, 11 |
| Median/percentiles | 2 |
| Immutable KG | 1, 10, 15–16 |
| Knowledge Verifier | 10 |
| Planner Validator + Improve | 13 |
| Narrative Optimizer | 12 |
| Section reason | 14 |
| Source diversity | 7–8, 17 |
| importanceScore 0–100 | 7 |
| Shared semanticMatch coverage | 3, 15 |
| Flag/fallback | 11 |
| AO new plan not graph edit | 16 |
| CIE naming | header + README |
| No dependsOn | explicit |

---

## Execution handoff

Plan saved: `docs/superpowers/plans/2026-08-04-knowledge-engine.md`.

**1. Subagent-Driven (recommended)**  
**2. Inline Execution**

Which approach?

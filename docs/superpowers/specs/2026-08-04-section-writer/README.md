# Section Writer + Compiled Write Plan v1

**Date:** 2026-08-04  
**Implementation plan:** [`docs/superpowers/plans/2026-08-04-section-writer.md`](../../plans/2026-08-04-section-writer.md)  
**Upstream (separate bounded context):** [`docs/superpowers/plans/2026-08-04-knowledge-acquisition-engine.md`](../../plans/2026-08-04-knowledge-acquisition-engine.md)

## One-liner

Content compiler v1: `ExecutionPlan` → **WritePlanCompiler** → **`CompiledWritePlan`** (+ **CompileDiagnostics**) → staged validators → Runtime `run(compiled)` → immutable results → **MdAst** → **HtmlRenderer**. Research publishes versioned snapshots — not ad-hoc results.

---

## 1. Iron rules / compiler metaphor

**Planner ≠ Runtime.** `ExecutionPlan` (Planner) is the planning artifact. `CompiledWritePlan` is a **compiled artifact**, not a DTO named `WriteEngineInput`.

```
ArticleExecutionPlan (Planner — planowanie)
        ↓
WritePlanCompiler (Section → Paragraph → [Flow] → Term → Constraint)
        ↓
CompileDiagnostics (warnings / infos / metrics)   ← nie blokuje samo
        ↓
CompiledWritePlan  (+ KnowledgeGraphSnapshot [+ Manifest w PR-B])
        ↓
Validators: Structural (PR-A) → Semantic + Runtime (PR-B)
        ↓
Runtime Writer → ParagraphResult[]  [immutable]
        ↓
Editorial Judge → ReviewedParagraphResult[]
        ↓
MdAst → HtmlRenderer → HTML
```

| Stage | Role |
|-------|------|
| **Planner** | Intent, outline, budgets, coverage — produces `ExecutionPlan` |
| **WritePlanCompiler** | Lowers plan into section/paragraph packs, terms, constraints |
| **CompiledWritePlan** | Frozen compiled artifact; Runtime only `run(compiled)` |
| **Validators** | Gate generate; staged delivery (see §3) |
| **Runtime** | Writer + Judge; no architectural decisions |

**Naming (locked):**

- `WritePlanCompiler` — not KnowledgePackAssembler
- `CompiledWritePlan` — not `WriteEngineInput`
- Deprecated alias `type WriteEngineInput = CompiledWritePlan` is **forbidden** — use the correct name from day one

**Forbidden public names / shapes:**

- `WriteEngineInput` as a public type name
- `paragraphInstructions: string[]`
- nested `paragraphs: ParagraphPlan[]` inside `KnowledgePack`
- `mustUseTerms: string[]` / `forbidden: string[]` string arrays on packs
- Writer → HTML without MdAst
- Single monolithic validator without stages
- Mutation of `ParagraphResult` by Judge

---

## 2. CompileDiagnostics

Diagnostics are **independent of validation errors**.

```typescript
CompileDiagnostics = {
  warnings: CompileDiagnostic[];  // level: 'warning'
  infos: CompileDiagnostic[];     // level: 'info'
  metrics: CompileMetrics;
}
```

**`CompileMetrics` fields:**

| Field | Meaning |
|-------|---------|
| `paragraphCount` | Total paragraphs in compiled plan |
| `packCount` | KnowledgePack count |
| `wordBudget` | Sum of expected words |
| `coveragePct` | 0–100 rough: questions with ≥1 paragraph assignment |
| `entityCoveragePct` | 0–100 rough: entities referenced / entities in graph (100 if graph empty) |

**Rule:** Diagnostics alone **never** block generate. Only validators set `ok: false`. UI may surface budgets/coverage from diagnostics without blocking. `CompiledWritePlan.diagnostics` is required on every compile.

Example diagnostic codes (non-exhaustive): `pack_small_budget`, `missing_transition`, `term_unassigned`.

---

## 3. Three validators (staged delivery)

| Stage | PR | Responsibility |
|-------|-----|----------------|
| **Structural** | PR-A | Refs exist: `paragraphPlanIds` ∈ registry, Claim/Fact/Entity/Source/Question refs resolve, `Fact.claimId` resolves, valid `Claim.status`, `dependsOnParagraphs` ids exist, non-empty ids |
| **Semantic** | PR-B | Coverage, transitions, term assignment, dependency cycles |
| **Runtime** | PR-B | Pre-run checks before Writer invocation |

**Delivery rule:** Writer only receives plans that pass **required stages for that PR**.

- **PR-A:** Structural only — thin compiler + structural gate + payload
- **PR-B:** Semantic + Runtime + full `validateCompiledWritePlan` pipeline
- **PR-C:** Writer, Judge, MdAst, HtmlRenderer
- **PR-D:** UI (Review Outline, strip, checklist)

All stages that are required for the current PR must return `ok: true` before `run(compiled)`.

---

## 4. KnowledgePack registry

`KnowledgePack` holds **`paragraphPlanIds: string[]` only**. `ParagraphPlan` lives in a **flat registry** (`paragraphPlans: ParagraphPlan[]` on `CompiledWritePlan`).

```
CompiledWritePlan
  ├── knowledgePacks[]     → paragraphPlanIds: string[]
  └── paragraphPlans[]     → flat registry (lookup by id)
```

**Never:**

- nested `paragraphs: ParagraphPlan[]` inside a pack
- `paragraphInstructions: string[]`
- `mustUseTerms: string[]`
- `forbidden: string[]`

Terms and constraints are structured (`TermUsage`, `WriterConstraint`) — not free-form string arrays on the pack.

---

## 5. Source → Claim → Fact

Knowledge graph lineage:

```
Source → Claim → Fact
```

| Type | Role |
|------|------|
| **Source** | Crawled/ingested document with authority, quotes, linked claim/entity ids |
| **Claim** | Extracted assertion; `status`: `raw` \| `normalized` \| `verified` |
| **Fact** | Derived statement; only from `verified` claims (`claimId` required) |

**Claim.status:**

- `raw` — extracted, unnormalized
- `normalized` — cleaned, not yet verified
- `verified` — eligible for Fact derivation

Thin PR-A path: compile may mark a claim `verified` and emit a Fact. Runtime Writer references claims/facts via `ClaimRef` / `FactRef` on `ParagraphPlan`.

---

## 6. Immutable ParagraphResult → ReviewedParagraphResult

**`ParagraphResult`** is **immutable** Writer output — never mutated by Judge.

```typescript
ParagraphResult = {
  paragraphId, sectionId, markdown, summary,
  confidence: number,        // 0–1 Writer self-assessment
  usedClaimIds, usedFactIds, usedEntityIds, usedTerms,
  coverage: { questionsAnswered, questionsMissed }
}
```

**`ReviewedParagraphResult`** is a **new object** — Judge does not mutate the base:

```typescript
ReviewedParagraphResult = {
  base: ParagraphResult;     // frozen reference / copy for audit
  markdown, summary, confidence,
  judgeNotes: string[];
  rewritten: boolean;
}
```

Judge: low `confidence` → rewrite path. Original `ParagraphResult` retained for audit.

---

## 7. Render path

Writer and Judge emit **markdown only** — not HTML.

```
markdown → MdAst → HtmlRenderer → HTML
```

- **MdAst** — minimal markdown AST (h2/p/ul/ol/li/strong/em/a/table)
- **HtmlRenderer** — sole HTML emission point
- HTML-aware assembler in Writer/Judge is **forbidden**

---

## 8. PipelineManifest + versioned KnowledgeGraphSnapshot

### KnowledgeGraphSnapshot

Versioned, immutable after publish. Pinned by Planner and Compiler.

```typescript
KnowledgeGraphSnapshot = {
  version: string;           // semver or monotonic "1"
  createdAt: string;       // ISO
  plannerVersion: string;
  researchVersion: string; // "none" until Acquisition
  sources, entities, claims, facts, questions
}
```

Planner and Compiler always know **which** snapshot was used. Stale snapshot → refresh (AO path).

### PipelineManifest

Records component versions at compile/generate time. Full manifest persisted in **PR-B**; PR-A may use placeholder (`compiledAt` + `compilerVersion`).

```typescript
PIPELINE_COMPONENT_VERSIONS = {
  planner: '2', compiler: '1', validator: '1',
  writer: '1', judge: '1', renderer: '1',
}

PipelineManifest = {
  plannerVersion, compilerVersion, validatorVersion,
  writerVersion, judgeVersion, rendererVersion,
  compiledAt: string;  // ISO
}
```

`CompiledWritePlan` carries both `graph: KnowledgeGraphSnapshot` and `manifest: PipelineManifest`.

---

## 9. Acquisition (separate plan)

Research / ingestion is **not** part of Section Writer. See [`2026-08-04-knowledge-acquisition-engine.md`](../../plans/2026-08-04-knowledge-acquisition-engine.md).

Acquisition **does not** return ad-hoc research results. It publishes a **versioned** `KnowledgeGraphSnapshot` that Planner / CIE / `WritePlanCompiler` consume via snapshot pin.

```
SERP / AI Search / Competitors / Official Docs
        ↓
Knowledge Acquisition Engine
  crawl → extract → dedupe → normalize → score → allocate
        ↓
KnowledgeGraphSnapshot (versioned, immutable after publish)
        ↓
Planner / CIE / WritePlanCompiler consume that snapshot pin
```

**Why separate:** Different bounded context than Planner → Compiler → Runtime.

---

## 10. Freeze

**Do not add** in this feature:

- event bus
- CQRS
- plugin system
- DI container
- graph execution framework

Keep the pipeline linear: compile → validate → run → judge → render.

---

## PR scope summary

| PR | Ships |
|----|-------|
| **PR-A** | Spec, types, CompileDiagnostics, thin compiler (Section+Paragraph+Term+Constraint, **no** FlowPlanner), Structural validator, `compiled_write_plan` payload |
| **PR-B** | FlowPlanner, Semantic + Runtime validators, full PipelineManifest |
| **PR-C** | Writer, Judge, MdAst, HtmlRenderer, progress, fail-closed |
| **PR-D** | Review Outline UI, Research strip, smoke |

**Out of scope:** LLM model swap, live TipTap, images, ad-hoc research injection.

---

## Canonical types

Target TypeScript contracts: `lib/contentPlanner/knowledgePack/types.ts` (Task 2).

Key exported types: `CompiledWritePlan`, `CompileDiagnostics`, `KnowledgePack`, `ParagraphPlan`, `KnowledgeGraphSnapshot`, `PipelineManifest`, `ParagraphResult`, `ReviewedParagraphResult`, `PackValidationResult`, `CompileResult`.

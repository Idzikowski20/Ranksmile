# Surfer Section Writer + Compiled Write Plan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kompilator treści v1: `ExecutionPlan` → Compile (+ **CompileDiagnostics**) → `CompiledWritePlan` → validate (staged) → Runtime → immutable results → MdAst → HtmlRenderer. Cienki PR-A najpierw. Research = osobny plan (publikuje wersjonowany snapshot).

**Architecture:**

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

**Freeze:** Nie dokładać event bus / CQRS / plugin system / DI / graph execution w tym planie.

Upstream: [`2026-08-04-knowledge-acquisition-engine.md`](./2026-08-04-knowledge-acquisition-engine.md).

**Tech Stack:** TypeScript strict (no `any`), Python sidecar OpenRouter GPT (**bez swapu**), Jest + pytest, Koala / editor zone, `job-progress`.

**UI:** `DESIGN.md` + `components/koala/REGISTRY.md` przed każdym taskiem UI.

---

## Locked decisions

| # | Topic | Decision |
|---|-------|----------|
| C1 | Planner ≠ Runtime | `ExecutionPlan` = planowanie. `CompiledWritePlan` = **skompilowany artefakt** (nie „DTO input”). Runtime tylko `run(compiled)`. |
| C2 | Naming | `WritePlanCompiler` (nie KnowledgePackAssembler). `CompiledWritePlan` (nie WriteEngineInput). |
| C3 | Validators | **Trzy:** Structural → Semantic → Runtime. Wszystkie muszą `ok` przed `run`. |
| C4 | ParagraphResult | **Immutable.** Judge produkuje `ReviewedParagraphResult` (kopia + patch), nie mutuje oryginału. |
| C5 | Render | Writer/Judge nie emitują HTML. Ścieżka: markdown → **MdAst** → **HtmlRenderer**. Assembler HTML-aware = zakazany. |
| C6 | Snapshot versioning | `KnowledgeGraphSnapshot.version`, `createdAt`, `plannerVersion`, `researchVersion`. |
| C7 | Paragraph deps | `ParagraphPlan.dependsOnParagraphs: string[]`. |
| C8 | Claim status | `Claim.status`: `raw` \| `normalized` \| `verified`. Fact tylko z `verified` (thin path: compile może oznaczyć claim verified + Fact). |
| C9 | FlowPlanner | Osobna funkcja: transitions / lead / hook / ending — **PR-B** (nie w cienkim PR-A). |
| C10 | Confidence | `ParagraphResult.confidence: number` (0–1). Judge: niski confidence → rewrite. |
| C11 | PipelineManifest | Zapisywany przy generate (**PR-B**): wersje komponentów pipeline. |
| C12 | CompileDiagnostics | Po compile, przed/obok validatorów: `warnings[]`, `infos[]`, `metrics` — **nie** mylić z errors. UI może pokazać budgets/coverage bez blokowania. |
| C13 | PR scope | **Cienki PR-A** (types + thin compiler + structural + payload). Semantic/Runtime/Manifest/Flow = **PR-B**. Writer/Judge/AST/Renderer = **PR-C**. UI = **PR-D**. |
| — | KP registry | `paragraphPlanIds[]` + flat `paragraphPlans` registry (bez nested plans). |
| — | Source→Claim→Fact | jak poprzednio. |
| — | EditorialMemory | obiekt (summary, entities, introducedConcepts, avoidRepeating). |
| — | TermUsage.actualOccurrences | null → wypełnia Runtime (nowy obiekt TermUsage / side map — nie mutuj planu jeśli compiled frozen; zapisz w result / post-write overlay). |
| — | Constraint.scope | paragraph \| section \| article. |
| — | Research / images / live TipTap | out of scope. |
| — | Model | bez swapu. |

**Zakazane:** `WriteEngineInput` jako nazwa publiczna, `paragraphInstructions: string[]`, nested `paragraphs: ParagraphPlan[]` w KP, mutacja `ParagraphResult`, Writer→HTML bezpośredni, pojedynczy monolityczny validator bez stage’y.

**Kompatybilność nazw w kodzie:** alias `/** @deprecated use CompiledWritePlan */ type WriteEngineInput = CompiledWritePlan` **zakazany** — od razu właściwa nazwa.

---

## Target types (`lib/contentPlanner/knowledgePack/types.ts`)

```typescript
export const PIPELINE_COMPONENT_VERSIONS = {
  planner: '2',
  compiler: '1',
  validator: '1',
  writer: '1',
  judge: '1',
  renderer: '1',
} as const;

export type PipelineManifest = {
  plannerVersion: string;
  compilerVersion: string;
  validatorVersion: string;
  writerVersion: string;
  judgeVersion: string;
  rendererVersion: string;
  compiledAt: string; // ISO
};

export type Source = {
  id: string;
  url: string;
  domain: string;
  authority: number;
  language: string;
  title: string;
  summary: string;
  claimIds: string[];
  entityIds: string[];
  quotes: string[];
};

export type ClaimStatus = 'raw' | 'normalized' | 'verified';

export type Claim = {
  id: string;
  text: string;
  sourceId: string | null;
  confidence: number;
  status: ClaimStatus;
};

export type Fact = {
  id: string;
  claimId: string;
  statement: string;
  confidence: number;
};

export type Entity = {
  id: string;
  name: string;
  kind: 'person' | 'place' | 'organization' | 'concept' | 'legal' | 'statistic' | 'other';
  aliases: string[];
};

export type Question = { id: string; text: string };

export type ExampleRef = { id: string; hint: string };
export type ClaimRef = { claimId: string };
export type FactRef = { factId: string };
export type EntityRef = { entityId: string };
export type QuestionRef = { questionId: string };
export type SourceRef = { sourceId: string };

export type TermUsage = {
  term: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  minOccurrences: number;
  maxOccurrences: number;
  preferredParagraphs: string[];
  required: boolean;
  actualOccurrences: number | null;
};

export type ConstraintScope = 'paragraph' | 'section' | 'article';

export type WriterConstraint = {
  type:
    | 'NoBrandMention'
    | 'NoMedicalAdvice'
    | 'NoTables'
    | 'NoFAQ'
    | 'NoExternalLinks'
    | 'Custom';
  value?: string;
  reason: string;
  severity: 'critical' | 'warning';
  scope: ConstraintScope;
  paragraphId?: string;
};

export type ParagraphGoal =
  | 'intro'
  | 'definition'
  | 'context'
  | 'problem'
  | 'symptoms'
  | 'benefits'
  | 'comparison'
  | 'warning'
  | 'example'
  | 'steps'
  | 'checklist'
  | 'faq'
  | 'summary'
  | 'cta';

export type ParagraphPlan = {
  id: string;
  sectionId: string;
  goal: ParagraphGoal;
  expectedWords: number;
  dependsOnParagraphs: string[];
  claims: ClaimRef[];
  facts: FactRef[];
  entities: EntityRef[];
  questions: QuestionRef[];
  keywords: TermUsage[];
  examples: ExampleRef[];
  sources: SourceRef[];
  transitionFrom?: string;
  transitionTo?: string;
  style: { list?: boolean; table?: boolean; boldTerms?: boolean };
  constraints: WriterConstraint[];
};

export type KnowledgePack = {
  id: string;
  sectionId: string;
  heading: string;
  objective: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedWords: number;
  paragraphPlanIds: string[];
  sectionClaimIds: string[];
  sectionFactIds: string[];
  sectionEntityIds: string[];
  sectionQuestionIds: string[];
  sectionSourceIds: string[];
  sectionExampleIds: string[];
  sectionConstraints: WriterConstraint[];
  sectionTransitions: {
    fromPrevious: string | null;
    toNext: string | null;
  };
};

export type EditorialMemory = {
  summary: string;
  entities: string[];
  introducedConcepts: string[];
  avoidRepeating: string[];
};

/** Immutable Writer output — never mutated by Judge. */
export type ParagraphResult = {
  paragraphId: string;
  sectionId: string;
  markdown: string;
  summary: string;
  confidence: number; // 0–1 Writer self-assessment
  usedClaimIds: string[];
  usedFactIds: string[];
  usedEntityIds: string[];
  usedTerms: Array<{ term: string; count: number }>;
  coverage: {
    questionsAnswered: string[];
    questionsMissed: string[];
  };
};

/** Judge output — new object; original ParagraphResult retained for audit. */
export type ReviewedParagraphResult = {
  base: ParagraphResult; // reference / frozen copy of original
  markdown: string;
  summary: string;
  confidence: number;
  judgeNotes: string[];
  rewritten: boolean;
};

export type KnowledgeGraphSnapshot = {
  version: string; // semver or monotonic "1"
  createdAt: string; // ISO
  plannerVersion: string;
  researchVersion: string; // "none" until Acquisition
  sources: Source[];
  entities: Entity[];
  claims: Claim[];
  facts: Fact[];
  questions: Question[];
};

export type CompileDiagnosticLevel = 'warning' | 'info';

export type CompileDiagnostic = {
  level: CompileDiagnosticLevel;
  code: string;
  message: string;
  packId?: string;
  paragraphId?: string;
};

export type CompileMetrics = {
  paragraphCount: number;
  packCount: number;
  wordBudget: number;
  /** 0–100 rough: questions with ≥1 paragraph assignment */
  coveragePct: number;
  /** 0–100 rough: entities referenced / entities in graph (100 if graph empty) */
  entityCoveragePct: number;
};

/** Warnings/infos/metrics from compile — independent of validation errors. */
export type CompileDiagnostics = {
  warnings: CompileDiagnostic[];
  infos: CompileDiagnostic[];
  metrics: CompileMetrics;
};

/** Compiled artifact — output of WritePlanCompiler, input to Runtime. */
export type CompiledWritePlan = {
  planHash: string;
  title: string;
  quickAnswer: string;
  keyword: string;
  knowledgePacks: KnowledgePack[];
  paragraphPlans: ParagraphPlan[];
  graph: KnowledgeGraphSnapshot;
  /** Filled in PR-B; PR-A may use placeholder manifest with compilerVersion only */
  manifest: PipelineManifest;
  diagnostics: CompileDiagnostics;
  coverageGaps?: Array<{
    text: string;
    importance: string;
    covered: boolean;
    paragraphId?: string;
  }>;
};

/** Minimal markdown AST — enough for h2/p/ul/ol/li/strong/em/a/table. */
export type MdNode =
  | { type: 'heading'; depth: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

export type MdAst = { children: MdNode[] };

export type ValidationStage = 'structural' | 'semantic' | 'runtime';

export type PackValidationIssue = {
  stage: ValidationStage;
  code: string;
  message: string;
  packId?: string;
  paragraphId?: string;
};

export type PackValidationResult = {
  ok: boolean;
  issues: PackValidationIssue[];
};

/** PR-A: structural only. PR-B: full pipeline. */
export type CompileResult =
  | { ok: true; plan: CompiledWritePlan; diagnostics: CompileDiagnostics }
  | { ok: false; issues: PackValidationIssue[]; diagnostics: CompileDiagnostics };
```

---

## File map

| File | PR | Responsibility |
|------|-----|----------------|
| `docs/superpowers/specs/2026-08-04-section-writer/README.md` | A | Contract |
| `lib/contentPlanner/knowledgePack/types.ts` | A | Types + diagnostics |
| `sectionPlanner.ts` / `paragraphPlanner.ts` | A | Thin compile steps |
| `termAllocator.ts` / `constraintAllocator.ts` | A | Minimal allocators |
| `compileDiagnostics.ts` | A | Build warnings/infos/metrics |
| `compileWritePlan.ts` | A | Thin WritePlanCompiler |
| `validateStructural.ts` | A | Refs exist |
| `toSidecarCompiledPlan.ts` | A | snake_case payload |
| `flowPlanner.ts` | B | transitions / lead / hook / ending |
| `validateSemantic.ts` / `validateRuntime.ts` | B | Remaining validators |
| `validateCompiledWritePlan.ts` | B | structural→semantic→runtime |
| `PIPELINE manifest fill` | B | Full `PipelineManifest` on compile |
| `section_writer.py` / judge / md_ast / html_renderer | C | Runtime |
| `article_pipeline.py` / progress | C | `run(compiled)` |
| UI + smoke | D | Review Outline, strip, checklist |

---

## PR split (final — thin first PR)

- **PR-A (Tasks 1–6)** — Spec, types (+ CompileDiagnostics), **thin** compiler (Section+Paragraph+Term+Constraint, **bez** FlowPlanner), **tylko Structural** validator, diagnostics, generate payload `compiled_write_plan`. Placeholder `manifest` OK. **No Writer.**  
- **PR-B (Tasks 7–10)** — FlowPlanner, Semantic + Runtime validators, full `validateCompiledWritePlan`, real PipelineManifest persist.  
- **PR-C (Tasks 11–15)** — Writer, Judge, MdAst, HtmlRenderer, progress, fail-closed, Generate bar.  
- **PR-D (Tasks 16–18)** — Review Outline UI, Research strip, smoke.  

---

## PR-A — Types, thin compiler, structural, payload

### Task 1: Spec

**Files:** `docs/superpowers/specs/2026-08-04-section-writer/README.md`

- [ ] Document: Compiler→Runtime, CompileDiagnostics vs validation errors, 3 validators (staged delivery), MdAst→Renderer, Manifest, Acquisition publishes snapshots (not “results”), freeze on further abstractions.

- [ ] Commit: `docs: CompiledWritePlan v1 contract + diagnostics`

---

### Task 2: Types

**Files:** `types.ts`, test, index export

- [ ] Include `CompileDiagnostics`, `CompileDiagnostic`, `CompileMetrics`, full domain types from this plan.
- [ ] `CompiledWritePlan.diagnostics` required.
- [ ] Placeholder manifest allowed in PR-A (`compiledAt` + `compilerVersion`; other versions may equal `PIPELINE_COMPONENT_VERSIONS` stubs).

- [ ] Commit: `feat(planner): CompiledWritePlan types + CompileDiagnostics`

---

### Task 3: `buildCompileDiagnostics`

**Files:** `compileDiagnostics.ts` + tests

```typescript
export function buildCompileDiagnostics(plan: Omit<CompiledWritePlan, 'diagnostics'>): CompileDiagnostics {
  // metrics: paragraphCount, packCount, wordBudget, coveragePct, entityCoveragePct
  // warnings examples:
  //  - pack expectedWords < 150 → code pack_small_budget
  //  - missing sectionTransitions on middle pack → missing_transition (info/warning; Semantic will error in PR-B)
  //  - required term with preferredParagraphs empty → term_unassigned
  // infos: packCount, keyword
}
```

- [ ] Diagnostics **never** alone set `ok: false` — only validators do.

- [ ] Commit: `feat(planner): CompileDiagnostics warnings + metrics`

---

### Task 4: Structural Validator

**Files:** `validateStructural.ts` + tests

Checks (errors only):
- every `paragraphPlanIds` ∈ registry
- Claim/Fact/Entity/Source/Question refs resolve
- Fact.claimId resolves; Claim.status valid enum
- `dependsOnParagraphs` ids exist (cycle check = Semantic PR-B)
- non-empty pack/paragraph ids

- [ ] Commit: `feat(planner): structural validator`

---

### Task 5: Thin WritePlanCompiler

**Files:** `sectionPlanner.ts`, `paragraphPlanner.ts`, `termAllocator.ts`, `constraintAllocator.ts`, `compileWritePlan.ts` + tests

**PR-A scope — YAGNI:**
- **Do** Section→Paragraph (dependsOn simple: later paras depend on first in section), Term + Constraint allocators, graph thin Claims+Facts, snapshot versioning (`researchVersion: 'none'`), call `buildCompileDiagnostics`, run **only** `validateStructural`.
- **Do not** implement FlowPlanner yet (leave transition fields null/empty; Semantic in PR-B will tighten).
- **Do not** require Semantic/Runtime.

```typescript
export function compileWritePlan(...): CompiledWritePlan { /* thin */ }

export function compileAndValidateWritePlan(...): CompileResult {
  const plan = compileWritePlan(...);
  const structural = validateStructural(plan);
  if (!structural.ok) {
    return { ok: false, issues: structural.issues, diagnostics: plan.diagnostics };
  }
  return { ok: true, plan, diagnostics: plan.diagnostics };
}
```

- [ ] Commit: `feat(planner): thin WritePlanCompiler + structural gate`

---

### Task 6: Serialize + generate payload

**Files:** `toSidecarCompiledPlan.ts`, `pages/api/articles/[id]/generate.ts`

- [ ] Attach `compiled_write_plan` + return/store `diagnostics` (warnings visible in API response even when ok).
- [ ] Structural fail → **422** `{ issues, diagnostics }`.
- [ ] Persist compiled JSON if easy; full manifest persist can wait for PR-B.
- [ ] Keep legacy `execution_plan` until PR-C.

- [ ] Commit: `feat: generate sends validated compiled_write_plan + diagnostics`

**PR-A done when:** types + diagnostics + thin compile + structural + payload; Writer still monolith.

---

## PR-B — Semantic, Runtime, Manifest, Flow

### Task 7: FlowPlanner

**Files:** `flowPlanner.ts` + wire into `compileWritePlan` + tests

- [ ] Fill `transitionFrom` / `transitionTo` and `sectionTransitions`.
- [ ] Commit: `feat(planner): FlowPlanner transitions`

---

### Task 8: Semantic Validator

**Files:** `validateSemantic.ts` + tests

- word budgets ±15%, dup goals, transitions, dependsOn DAG (no cycles), order constraints.

- [ ] Commit: `feat(planner): semantic validator`

---

### Task 9: Runtime Validator

**Files:** `validateRuntime.ts` + tests

- graph/packs/registry/manifest/title/keyword ready for Writer.

- [ ] Commit: `feat(planner): runtime validator`

---

### Task 10: Full validate + Manifest persist

**Files:** `validateCompiledWritePlan.ts`, tighten `compileAndValidateWritePlan`, `generate.ts`

```typescript
export function validateCompiledWritePlan(plan: CompiledWritePlan): PackValidationResult {
  const issues = [
    ...validateStructural(plan).issues,
    ...validateSemantic(plan).issues,
    ...validateRuntime(plan).issues,
  ];
  return { ok: issues.length === 0, issues };
}
```

- [ ] Full `PipelineManifest` from `PIPELINE_COMPONENT_VERSIONS`; persist on article.
- [ ] Generate requires full validate before kickoff.
- [ ] Commit: `feat: full compile validate + PipelineManifest persist`

**PR-B done when:** 3 validators + Flow + manifest; still no new Writer.

---

## PR-C — Runtime Writer / Judge / Render

### Task 11: Writer → ParagraphResult

- [ ] Immutable markdown + confidence + usedTerms; no article HTML.
- [ ] Commit: `feat(sidecar): Writer emits ParagraphResult`

---

### Task 12: Judge → ReviewedParagraphResult

- [ ] New object; low confidence / critical gap → rewrite; never mutate `base`.
- [ ] Commit: `feat(sidecar): Judge yields ReviewedParagraphResult`

---

### Task 13: MdAst + HtmlRenderer

- [ ] markdown → AST → HTML; conformity on render.
- [ ] Commit: `feat(sidecar): MdAst + HtmlRenderer`

---

### Task 14: `run(compiled)` + progress + fail-closed

- [ ] Loop packs/paragraphs; EditorialMemory; no monolith when plan present.
- [ ] Commit: `feat(sidecar): run CompiledWritePlan runtime`

---

### Task 15: Generate content bar

- [ ] Surfer labels.
- [ ] Commit: `fix(ui): Generate content bar labels`

**PR-C done when:** compile → run → review → render works E2E.

---

## PR-D — UI + smoke

### Task 16: Review Outline + PATCH

- [ ] Edit by paragraph id; recompile+validate; show **diagnostics.warnings** in UI (not only hard errors).
- [ ] Competitors | Questions | Notes.
- [ ] Commit: `feat(ui): Review Outline + diagnostics display`

---

### Task 17: ResearchProgressStrip

- [ ] Real stages only.
- [ ] Commit: `feat(ui): research progress checklist`

---

### Task 18: Smoke doc

1. Structural dangling ref → 422 + diagnostics  
2. Soft warning (small budget) → ok:true + warnings[]  
3. Semantic words mismatch (after PR-B) → 422  
4. Manifest persisted  
5. Judge keeps original ParagraphResult  
6. MdAst render path  
7. Acquisition not required  

- [ ] Commit: `docs: CompiledWritePlan smoke checklist`

---

## Self-review

| Item | Where |
|------|--------|
| Thin PR-A | C13, Tasks 1–6 |
| CompileDiagnostics | C12, Task 3 |
| 3 validators staged | A structural / B semantic+runtime |
| No over-architecture | Freeze note |
| Acquisition → versioned snapshot | stub update |

**Stop expanding this plan.** Next step = implement.

---

## Execution

Plan frozen at v1 architecture + thin PR-A. File: `docs/superpowers/plans/2026-08-04-section-writer.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)**  
2. **Inline Execution**

Which approach?

# 11 — Action Graph (domain)

Action Graph is **not** a consumer. It is a first-class **immutable** derived artifact, version-locked to CCM.

```text
CCM v17  (immutable)
    │
    ▼
Action Graph Builder
    │
    ▼
ActionGraph v17  (immutable — same version / contentHash)
    │
    ▼
Planner (Action Budget + strategy)
    │
    ▼
AO / Writer → recompile → CCM v18 → ActionGraph v18
```

**Never** a mutable “ActionGraph current” singleton. New CCM version ⇒ new ActionGraph (or explicit null if `!capabilities.planner`).

## Builder

```ts
export interface ActionGraphBuilder {
  build(model: CanonicalContentModel): ActionGraph;
}

export interface ActionGraph {
  readonly schemaVersion: 1;
  readonly immutable: true;
  readonly fromCcmVersion: number;        // MUST equal model.version
  readonly contentHash: string;           // MUST equal model.contentHash
  /** Hash of knowledge.graph identity (nodes+edges canonical) at build time */
  readonly fromKnowledgeGraphHash: string;
  readonly builtAt: string;
  readonly actions: readonly EditAction[];
  readonly roots: readonly string[];
}
```

## Planner — stateless

Planner **MUST NOT** hold session state between runs.

```text
PlannerInput → Plan → History(CompileEvent PlannerRun) → Done
```

No in-memory “Planner still working on article X” singleton. Resume = new `accept(context)` with history tail + fresh ActionGraph snapshot.

```ts
export type PlannerStrategy = 'fast' | 'balanced' | 'aggressive' | 'enterprise';

export interface PlannerInput {
  readonly context: ConsumerContext;
  readonly budget: ActionBudget;
  readonly priority: 'low' | 'normal' | 'high';
  readonly strategy: PlannerStrategy;
}

export interface ActionBudget {
  readonly maxActions: number;
  readonly maxLlmCalls: number;
  readonly maxTokens?: number;
  readonly maxDurationMs?: number;
}

export interface Plan {
  readonly fromCcmVersion: number;
  readonly fromActionGraphHash: string;
  readonly strategy: PlannerStrategy;
  readonly selected: readonly EditAction[];   // each carries Recommendation DSL op
  readonly deferred: readonly string[];       // action ids over budget
}
```

Planner **subsets** the immutable ActionGraph under budget; it does not invent actions outside the graph without a Builder re-run. Canonical action semantics: **`20-recommendation-dsl.md`**.

## EditAction

Kinds include: `add_fact`, `strengthen_evidence`, `cover_intent`, `answer_question`, `fix_structure`, `fix_presentation`, `resolve_conflict`, `dedupe_fact`, `refresh_outdated`.

Fields: `id`, `kind`, `priority`, `dependsOn`, targets, `sectionHint`, `astPath`, `promptFragment`, `expectedImpact`, `evidenceRequired`, `rationalePath` (reasoning/KG ids).

## Derivation rules

1. Uncovered primary Intent → `cover_intent` + child fact actions  
2. Fact weak/partial without evidence → `strengthen_evidence`  
3. Question unanswered → `answer_question`  
4. Conflicts before new facts in cluster  
5. Presentation policy gaps → `fix_presentation`  
6. Topo-sort by `dependsOn`, then priority  

## Non-goals

- Does not rewrite HTML  
- Does not own scores  
- Not a live mutable work queue (History records PlannerRun events instead)

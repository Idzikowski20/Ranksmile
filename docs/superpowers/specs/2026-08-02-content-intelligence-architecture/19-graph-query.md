# 19 — Graph Query API

## Why

Benchmark, Planner, Judge, Constraint Engine must not scatter `edgesByType` / manual index walks. Indexes stay an **implementation detail** of CCM; consumers use `GraphQuery`.

```ts
export interface GraphQuery {
  findFacts(filter?: FactFilter): readonly FactNode[];
  findEntities(filter?: EntityFilter): readonly EntityNode[];
  findIntents(filter?: IntentFilter): readonly IntentNode[];
  findQuestions(filter?: QuestionFilter): readonly QuestionNode[];
  node(id: string): KgNode | undefined;
  neighbors(id: string, edgeType?: KgEdgeType, dir?: 'out' | 'in' | 'both'): readonly KgNode[];
  traverse(startId: string, opts: TraverseOpts): readonly string[]; // node ids
  findSubgraph(pattern: SubgraphPattern): readonly SubgraphMatch[];
  explain(nodeId: string): ReasoningPath;   // uses Reasoning Graph + confidence
}

export interface SubgraphPattern {
  readonly rootKind: KgNodeKind;
  readonly edgePath: readonly KgEdgeType[];  // e.g. supports ← uses ← supportedBy motif DSL
  readonly requiredStatuses?: readonly CoverageStatus[];
}

export interface SubgraphMatch {
  readonly nodeIds: readonly string[];
  readonly edgeIds: readonly string[];
  readonly missingRoles: readonly string[];  // for gap detection
}

export function graphQuery(model: CanonicalContentModel): GraphQuery;
```

**Code:** `lib/ccm/graphQuery.ts`.

## Rules

1. Only `graphQuery(model)` (or inject in `ConsumerContext.runtime`) accesses indexes.  
2. Benchmark subgraph matching goes through `findSubgraph`.  
3. Explainability UI uses `explain()` (confidence-aware — see Reasoning).  
4. Direct `model.knowledge.indexes.*` access outside compiler/index builder = architecture test failure.

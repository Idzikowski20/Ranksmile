# 01 — Canonical Content Model (CCM)

**Code:** `lib/ccm/` (`types/`, `emptyCcm`, `buildIndexes`, `serialize`, `builders/`).

## Role

After a successful compile, the **Canonical Content Model** is the only Source of Truth for meaning, structure, and optimization.

**CCM = Snapshot. No exceptions.** There is no mutable “current CCM” or “latest CCM” object in memory that modules update in place. Callers hold `CcmSnapshot` references (`version`, `deterministicHash`). “Latest” is only a **pointer** in storage (`article.ccm_version → snapshot`), never a shared mutable model.

**Knowledge Graph is one slice of CCM — not the whole model.**

```text
Canonical Content Model          (immutable snapshot)
├── ast                 Lexical AST
├── semanticAst         Semantic AST (text-level)
├── ir                  Intermediate Representation (meaning candidates)  ← see 15-ir.md
├── knowledge
│   ├── graph           readonly KnowledgeGraph
│   └── indexes         readonly GraphIndexes (entity/fact/…)
├── structure
├── presentation
├── metadata
├── reasoning           Reasoning Graph (DAG) — not a flat list
├── metrics             projections only
├── statistics
├── references
├── embeddings
├── compiler            CompilerMetadata + capabilities + deterministicHash
└── legacy              migration bridge only
```

## Manifest

> Coverage is a side effect of a good compile — not the product.

**Coverage Projection** (not “Coverage Engine”) projects knowledge + metrics. It does not own truth.

## Envelope (v1)

```ts
/** Target: lib/types/ccm.ts */

export type CcmSchemaVersion = 1;

export interface CanonicalContentModel {
  readonly schemaVersion: CcmSchemaVersion;
  readonly ccmId: string;
  readonly articleId: string;
  readonly contentHash: string;
  readonly version: number;
  readonly compiledAt: string;
  readonly profile: ContentProfileId;
  readonly immutable: true;

  readonly ast: LexicalAst;
  readonly semanticAst: SemanticAst;
  readonly ir: ContentIr;

  readonly knowledge: KnowledgeSlice;
  readonly structure: StructureSlice;
  readonly presentation: PresentationSlice;
  readonly metadata: ContentMetadata;
  readonly reasoning: ReasoningGraph;
  readonly metrics: ContentMetrics;
  readonly statistics: ContentStatistics;
  readonly references: ReferenceIndex;
  readonly embeddings: EmbeddingIndex | null;
  readonly compiler: CompilerMetadata;
  readonly legacy?: LegacyBridge;
}

export interface KnowledgeSlice {
  readonly graph: KnowledgeGraph;       // readonly by type + convention
  readonly indexes: GraphIndexes;       // part of model, not ad-hoc runtime maps
}

/** O(1) lookups — ReadonlyMap (immutable-friendly). Wire format: sorted entry arrays (see serialize). */
export interface GraphIndexes {
  readonly byId: ReadonlyMap<string, KgNode>;
  readonly entityByCanonical: ReadonlyMap<string, string>;
  readonly factsByEntityId: ReadonlyMap<string, readonly string[]>;
  readonly factsByIntentId: ReadonlyMap<string, readonly string[]>;
  readonly questionsByIntentId: ReadonlyMap<string, readonly string[]>;
  readonly intentsByParentId: ReadonlyMap<string, readonly string[]>;
  readonly evidenceByFactId: ReadonlyMap<string, readonly string[]>;
  readonly edgesByFrom: ReadonlyMap<string, readonly string[]>;
  readonly edgesByTo: ReadonlyMap<string, readonly string[]>;
  readonly edgesByType: ReadonlyMap<string, readonly string[]>;
}
```

### Reasoning Graph (DAG)

Explainability is a traversable graph, not prose blobs alone.

```ts
export interface ReasoningGraph {
  readonly nodes: readonly ReasoningNode[];
  readonly edges: readonly ReasoningEdge[];
}

export type ReasoningNodeKind =
  | 'fact'
  | 'intent'
  | 'coverage'
  | 'recommendation'
  | 'metric'
  | 'evidence'
  | 'conflict';

export interface ReasoningNode {
  readonly id: string;
  readonly kind: ReasoningNodeKind;
  readonly refId?: string;              // KG node / action id
  readonly summary: string;
  readonly confidence: number;          // 0..1 — never silently assume 1
}

export interface ReasoningEdge {
  readonly id: string;
  readonly type: 'supports' | 'explains' | 'implies' | 'blocks' | 'recommends';
  readonly from: string;
  readonly to: string;
  readonly weight: number;              // 0..1 contribution along the edge
}

/**
 * Confidence propagation (v1):
 * child.confidence = min(own, min_over_support_edges(parent.confidence * edge.weight))
 * Recommendations inherit the bottleneck confidence of their support path.
 * graphQuery.explain() MUST return path + propagatedConfidence.
 */
```

Example path:

```text
Fact → supports → Intent → explains → Coverage gap → recommends → Action
```

### Structure / Presentation / Metadata

Unchanged in role from v0.2 (sections, rhetoric, SEO/AI signals). See prior field lists; every field must satisfy **field ownership** (`16-field-ownership.md`).

```ts
export type ContentProfileId =
  | 'blog' | 'landing' | 'medical' | 'news' | 'legal'
  | 'product' | 'saas' | 'travel' | 'finance' | 'generic';
```

## Invariants

1. CCM snapshots are **immutable** once persisted.  
2. `knowledge.graph` and `knowledge.indexes` are readonly; indexes must be consistent with graph.  
3. `metrics.*` recomputable from CCM + profile — never hand-edited truth.  
4. Fresh CCM ⇒ consumers MUST NOT analyze HTML for semantics (ADR-001).  
5. EvidenceSpan anchors to `ast.blockId`; builders consume **IR** for discovery.  
6. No CCM field without owner / producer / consumer (`16-field-ownership.md`).  
7. `legacy` is migration/compat only — new modules MUST NOT depend on it.

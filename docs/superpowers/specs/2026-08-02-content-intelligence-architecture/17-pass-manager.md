# 17 — Pass Manager & Stage Registry

## Problem

Hard-coding `Entity → Fact → Intent → …` inside the compiler does not scale to:

`MedicalPass` · `FinancePass` · `LegalPass` · `MultilingualPass` · `CitationPass` · `HallucinationPass` · …

## CompilerPass

```ts
export interface CompilerPass {
  readonly id: string;
  readonly version: string;
  readonly costClass: 'heuristic' | 'ner' | 'embedding' | 'llm' | 'hybrid';
  readonly dependsOn: readonly string[];     // other pass ids
  /** Pass ids / IR regions whose outputs this pass may invalidate */
  readonly invalidates: readonly string[];
  run(input: PassInput): Promise<PassOutput> | PassOutput;
}

export interface PassInput {
  readonly ast: LexicalAst;
  readonly semanticAst: SemanticAst;
  readonly ir: ContentIr;
  readonly draft: DraftGraph;                // mutable only inside PassManager transaction
  readonly ctx: CompileContext;
}

export interface PassOutput {
  readonly irPatch?: ContentIrPatch;
  readonly graphPatch?: EnginePatch;
  readonly reasoningPatch?: ReasoningPatch;
  readonly trace: StageTrace;
}
```

## PassManager

```ts
export interface PassManager {
  register(pass: CompilerPass): void;
  /** Topo-sort by dependsOn; run; apply invalidates; collect traces */
  runAll(input: PassInput, enabled: readonly string[]): Promise<PassManagerResult>;
}

export interface PassManagerResult {
  readonly ir: ContentIr;
  readonly draft: DraftGraph;
  readonly traces: readonly StageTrace[];
  readonly failedPassIds: readonly string[];
}
```

Pipeline (conceptual):

```text
Lexer → Parser → Semantic → IR Builder
        → PassManager[ EntityPass, FactPass, IntentPass, RelationPass, EvidencePass, …profile passes ]
        → Constraint Engine
        → Index Builder → Reasoning Builder → Aggregator
        → CCM Snapshot
```

Profile may enable extra passes (`MedicalPass`) via registry + `CompilerCapabilities` / profile flags — **not** by editing the compiler core.

## Stage Registry

Fixed frontend stages + dynamic passes share one registry:

```ts
export interface StageRegistryEntry {
  readonly id: string;                       // 'lexer' | 'fact_pass' | …
  readonly kind: 'stage' | 'pass';
  readonly version: string;
  readonly dependsOn: readonly string[];
  readonly costClass: CompilerPass['costClass'];
  readonly optional: boolean;
}

export interface StageRegistry {
  readonly entries: readonly StageRegistryEntry[];
  resolveOrder(enabledIds: readonly string[]): readonly string[];
}
```

`CompilerMetadata.modelVersions` / traces key off registry ids.

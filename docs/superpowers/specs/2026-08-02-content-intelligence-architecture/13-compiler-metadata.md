# 13 — Compiler Metadata

```ts
export interface CompilerMetadata {
  /** Stable compiler identity, e.g. `"cia-v1"`. */
  readonly compilerId: string;
  readonly compileVersion: string;
  readonly promptVersion: string;
  readonly rulesVersion: string;
  readonly embeddingVersion: string | null;
  readonly irVersion: string;
  readonly modelVersions: Readonly<Record<string, string>>;
  readonly profileId: ContentProfileId;
  readonly mode: 'full' | 'incremental' | 'adapter';
  readonly partial: boolean;
  readonly failedStages: readonly CompilerStageId[];
  readonly capabilities: CompilerCapabilities;
  /** Hash(AST + rulesVersion + promptVersion + profile + irVersion [+ serpBriefHash]) */
  readonly deterministicHash: string;
  readonly compileDurationMs: number;
  readonly tokenUsage: TokenUsage;
  readonly cost: CostEstimate;
  readonly confidence: number;
  readonly notes: readonly string[];
  readonly stagePromptVersions?: Readonly<Record<string, string>>;
}

export interface CompilerCapabilities {
  readonly incremental: boolean;
  readonly wikidata: boolean;
  readonly embeddings: boolean;
  readonly citations: boolean;
  readonly reasoning: boolean;
  readonly planner: boolean;
  readonly ir: boolean;
}

export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface CostEstimate {
  readonly currency: 'USD';
  readonly amount: number;
  readonly breakdown?: Readonly<Record<string, number>>;
}
```

## deterministicHash uses

- History: detect identical compile (skip redundant events / mark noop)  
- Judge: “no semantic change” short-circuit when hash equal and contentHash equal  
- Benchmark: cache competitor CCM by hash  
- Cache invalidation independent of wall-clock `compiledAt`

## Rules

- Always present on persisted CCM (adapter included).  
- `capabilities.ir === false` only for documented adapter shims.  
- Publish gate may require `!partial && confidence ≥ T && capabilities.ir`.

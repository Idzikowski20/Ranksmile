# 12 — Consumer Contracts

## Frozen contract

```ts
export interface ContentConsumer<TResult> {
  readonly id: ConsumerId;
  accept(context: ConsumerContext): Promise<ConsumerResult<TResult>> | ConsumerResult<TResult>;
}

export type ConsumerId =
  | 'coverage_projection'
  | 'visibility_projection'
  | 'action_graph_builder'
  | 'planner'
  | 'judge'
  | 'benchmark'
  | 'writing_intelligence'
  | 'editorial_intelligence'
  | 'optimization_intelligence'
  | 'history';

export interface ConsumerContext {
  readonly model: CanonicalContentModel;      // snapshot ref — never mutate
  readonly priorModel?: CanonicalContentModel;
  readonly diff?: ModelDiff;
  readonly actionGraph?: ActionGraph;
  readonly history?: readonly CompileEvent[];
  readonly cache?: ConsumerCacheHandle;
  readonly runtime?: RuntimeHandle;           // graphQuery(), notify, replay handles
  readonly budget?: ActionBudget;
  readonly peerResults?: PeerResults;
}

/** runtime.graphQuery(model) is the only supported graph access for consumers */

export interface PeerResults {
  readonly coverage?: unknown;
  readonly judge?: unknown;
  readonly planner?: unknown;
  readonly visibility?: unknown;
  readonly benchmark?: unknown;
}

export interface ConsumerResult<T> {
  readonly consumerId: ConsumerId;
  readonly fromCcmVersion: number;
  readonly confidence: number;
  readonly result: T;
  readonly recommendations?: readonly EditAction[];
  readonly trace?: { readonly notes: readonly string[] };
}
```

## Rules

1. **`accept(context)`** — not bare `accept(model)`. Model is always `context.model`.  
2. No HTML semantic analysis when CCM fresh (ADR-001).  
3. Check `model.compiler.capabilities.*` before assuming features.  
4. Results are projections/verdicts — never a second SoT.  
5. Cache key includes `model.compiler.deterministicHash` + consumer id + budget/strategy when relevant.

## Result types

| ConsumerId | TResult |
|------------|---------|
| coverage_projection | `CoverageView` |
| visibility_projection | `VisibilityProjection` |
| action_graph_builder | `ActionGraph` |
| planner | `EditPlan` |
| judge | `JudgeVerdict` |
| benchmark | `BenchmarkReport` (subgraph gaps) |
| writing_intelligence | `WiScorecard` |
| history | `HistoryAppendAck` |

## Writing Intelligence = meta-consumer

Reads `context.model` + `context.peerResults`; does not re-extract knowledge.

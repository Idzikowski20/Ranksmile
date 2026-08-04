# 14 — Diff, Events & History

## Event sourcing (primary)

History is a stream of **CompileEvents**, not a pile of stored ModelDiff blobs as the only record.

```ts
export type CompileEvent =
  | { readonly type: 'CompileStarted'; readonly at: string; readonly articleId: string; readonly mode: string }
  | { readonly type: 'CompileFinished'; readonly at: string; readonly ccmVersion: number; readonly deterministicHash: string; readonly partial: boolean }
  | { readonly type: 'ActionGraphBuilt'; readonly at: string; readonly ccmVersion: number }
  | { readonly type: 'PlannerRun'; readonly at: string; readonly ccmVersion: number; readonly strategy: string; readonly selectedActionIds: readonly string[] }
  | { readonly type: 'OptimizerRun'; readonly at: string; readonly ccmVersion: number }
  | { readonly type: 'JudgeRun'; readonly at: string; readonly fromVersion: number; readonly toVersion: number; readonly verdict: string }
  | { readonly type: 'Publish'; readonly at: string; readonly ccmVersion: number }
  | { readonly type: 'Rollback'; readonly at: string; readonly toCcmVersion: number }
  | { readonly type: 'ConsumerRun'; readonly at: string; readonly consumerId: string; readonly ccmVersion: number };

export interface CompileHistoryRecord {
  readonly articleId: string;
  readonly version: number;                   // CCM version this record anchors
  readonly contentHash: string;
  readonly deterministicHash: string;
  readonly recordedAt: string;
  /** Optional materialization for fast UI — events remain authoritative */
  readonly snapshot?: {
    readonly ccmRef: string;                  // storage pointer / id
    readonly actionGraphRef?: string;
    readonly scores: { contentScore: number; seoScore?: number; wiScore?: number };
  };
}
```

ModelDiff is **derived** when needed (Judge, UI), or attached to `JudgeRun` — not the sole history substrate.

## ModelDiff (derived, multi-layer)

Still defined for Judge/UI:

- `astDiff` · `graphDiff` · `reasoningDiff` · `scoreDiff` · `recommendationDiff`

See prior field lists; compute via `diffModels(before, after)`.

## Identical compile

If `deterministicHash` unchanged (and policy allows), emit lightweight `CompileFinished` with noop flag — avoid duplicating huge snapshots.

## Replay

History must support deterministic **replay** for debugging:

```ts
export interface ReplayApi {
  replayCompile(articleId: string, toVersion: number): Promise<CanonicalContentModel>;
  replayPlanner(articleId: string, eventId: string): Promise<Plan>;
  replayBenchmark(articleId: string, eventId: string): Promise<BenchmarkReport>;
  replayJudge(articleId: string, eventId: string): Promise<JudgeVerdict>;
}
```

Replay uses stored snapshot refs + event payloads + same `deterministicHash` inputs (rules/prompt versions). If inputs missing → replay fails loudly (no silent “best effort” HTML re-parse).

**Skeleton (Etap 7):** `lib/compiler/replay.ts` — `replayRoundTrip` (serialize↔parse + hash verify) and `replayCompileFromSource` (re-compile + optional expected hash). Full History `ReplayApi` (articleId/version store) lands with persistence.

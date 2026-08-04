# 20 — Recommendation DSL

## Problem

String recommendations diverge across Planner, Judge, AO, WIE.

## Structured ops (v1)

```ts
export type RecommendationOp =
  | {
      readonly op: 'ADD_FACT';
      readonly targetIntentId: string;
      readonly fact: { subject: string; predicate: string; object: string; statement: string };
      readonly expected: RecommendationExpectations;
    }
  | {
      readonly op: 'STRENGTHEN_EVIDENCE';
      readonly factId: string;
      readonly sectionHint?: string;
      readonly expected: RecommendationExpectations;
    }
  | {
      readonly op: 'COVER_INTENT';
      readonly intentId: string;
      readonly expected: RecommendationExpectations;
    }
  | {
      readonly op: 'ANSWER_QUESTION';
      readonly questionId: string;
      readonly expected: RecommendationExpectations;
    }
  | {
      readonly op: 'FIX_STRUCTURE';
      readonly blockId?: string;
      readonly kind: 'opening' | 'summary' | 'faq' | 'heading';
      readonly expected: RecommendationExpectations;
    }
  | {
      readonly op: 'RESOLVE_CONFLICT';
      readonly factIds: readonly string[];
      readonly expected: RecommendationExpectations;
    }
  | {
      readonly op: 'REFRESH_OUTDATED';
      readonly factId: string;
      readonly expected: RecommendationExpectations;
    };

export interface RecommendationExpectations {
  readonly expectedScoreDelta?: number;       // Content Score
  readonly expectedVisibilityDelta?: number;  // Visibility completeness 0..1
  readonly expectedReasoning?: string;        // human/debug summary of path
  readonly expectedConfidenceMin?: number;
}
```

## Binding

- `EditAction.promptFragment` may be derived from DSL; **canonical plan item is the op**.  
- Action Graph stores `readonly dsl: RecommendationOp` on each action (or 1:1 map).  
- Judge verifies expectations post-hoc against ModelDiff / Visibility Projection.  
- AO/WIE Writer render prompts from DSL — not the other way around.

## Non-goal

Full programming language. Closed op union versioned with `schemaVersion`.

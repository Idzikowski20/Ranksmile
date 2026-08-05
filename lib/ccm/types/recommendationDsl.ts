import type { ObjectId, PredicateId, SubjectId } from './ids';

export interface RecommendationExpectations {
  readonly expectedScoreDelta?: number;
  readonly expectedVisibilityDelta?: number;
  readonly expectedReasoning?: string;
  readonly expectedConfidenceMin?: number;
}

export type RecommendationOp =
  | {
      readonly op: 'ADD_FACT';
      readonly targetIntentId: string;
      readonly fact: {
        readonly subject: SubjectId;
        readonly predicate: PredicateId;
        readonly object: ObjectId;
        readonly statement: string;
      };
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

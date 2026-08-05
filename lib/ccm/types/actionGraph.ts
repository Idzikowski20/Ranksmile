import type { RecommendationOp } from './recommendationDsl';

export type EditActionKind =
  | 'add_fact'
  | 'strengthen_evidence'
  | 'cover_intent'
  | 'answer_question'
  | 'fix_structure'
  | 'fix_presentation'
  | 'resolve_conflict'
  | 'dedupe_fact'
  | 'refresh_outdated';

export interface EditAction {
  readonly id: string;
  readonly kind: EditActionKind;
  readonly priority: number;
  readonly dependsOn: readonly string[];
  readonly targetIntentId?: string;
  readonly targetQuestionId?: string;
  readonly targetFact?: {
    readonly subject: string;
    readonly predicate: string;
    readonly object: string;
    readonly statement: string;
  };
  readonly sectionHint?: string;
  readonly astPath?: string;
  readonly promptFragment: string;
  readonly expectedImpact: number;
  readonly evidenceRequired: boolean;
  readonly rationalePath: readonly string[];
  readonly dsl: RecommendationOp;
}

export interface ActionGraph {
  readonly schemaVersion: 1;
  readonly immutable: true;
  readonly fromCcmVersion: number;
  readonly contentHash: string;
  readonly fromKnowledgeGraphHash: string;
  readonly builtAt: string;
  readonly actions: readonly EditAction[];
  readonly roots: readonly string[];
}

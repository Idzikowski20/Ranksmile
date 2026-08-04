export type SemanticCandidateKind =
  | 'entity'
  | 'fact'
  | 'relation'
  | 'intent'
  | 'question'
  | 'topic';

export interface SemanticCandidateBase {
  readonly id: string;
  readonly kind: SemanticCandidateKind;
  readonly confidence: number;
  readonly blockIds: readonly string[];
  readonly claimId?: string;
}

export interface EntityCandidate extends SemanticCandidateBase {
  readonly kind: 'entity';
  readonly surface: string;
  readonly canonicalHint?: string;
}

export interface FactCandidate extends SemanticCandidateBase {
  readonly kind: 'fact';
  readonly statement: string;
  readonly subject?: string;
  readonly predicate?: string;
  readonly object?: string;
  readonly entityCandidateIds: readonly string[];
}

export interface RelationCandidate extends SemanticCandidateBase {
  readonly kind: 'relation';
  readonly type: string;
  readonly fromCandidateId: string;
  readonly toCandidateId: string;
}

export interface IntentCandidate extends SemanticCandidateBase {
  readonly kind: 'intent';
  readonly label: string;
  readonly userGoal?: string;
  readonly priority: number;
  readonly parentCandidateId?: string;
}

export interface QuestionCandidate extends SemanticCandidateBase {
  readonly kind: 'question';
  readonly question: string;
  readonly relatedIntentCandidateIds: readonly string[];
}

export interface TopicCandidate extends SemanticCandidateBase {
  readonly kind: 'topic';
  readonly label: string;
}

export type SemanticCandidate =
  | EntityCandidate
  | FactCandidate
  | RelationCandidate
  | IntentCandidate
  | QuestionCandidate
  | TopicCandidate;

export interface IrParagraph {
  readonly id: string;
  readonly blockId: string;
  readonly claimIds: readonly string[];
}

export interface IrClaim {
  readonly id: string;
  readonly paragraphId: string;
  readonly blockId: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly text: string;
  readonly kind: 'factish' | 'definition' | 'opinion' | 'other';
}

export interface ContentIr {
  readonly version: 1;
  readonly contentHash: string;
  readonly paragraphs: readonly IrParagraph[];
  readonly claims: readonly IrClaim[];
  readonly candidates: readonly SemanticCandidate[];
}

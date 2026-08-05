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
  readonly refId?: string;
  readonly summary: string;
  readonly confidence: number;
}

export interface ReasoningEdge {
  readonly id: string;
  readonly type: 'supports' | 'explains' | 'implies' | 'blocks' | 'recommends';
  readonly from: string;
  readonly to: string;
  readonly weight: number;
}

export interface ReasoningGraph {
  readonly nodes: readonly ReasoningNode[];
  readonly edges: readonly ReasoningEdge[];
}

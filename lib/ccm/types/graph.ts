import type { CoverageStatus, FactVerification, Importance } from './status';

export type KgEdgeType =
  | 'uses'
  | 'belongsTo'
  | 'supports'
  | 'answers'
  | 'supportedBy'
  | 'statedIn'
  | 'references'
  | 'causes'
  | 'mentions'
  | 'contradicts'
  | 'duplicates'
  | 'derivedFrom'
  | 'relatedTo'
  | 'sameAs'
  | 'parentOf'
  | 'answeredBy';

export type KgNodeKind =
  | 'fact'
  | 'entity'
  | 'intent'
  | 'question'
  | 'topic'
  | 'section'
  | 'citation'
  | 'evidence_span';

export interface FactNode {
  readonly id: string;
  readonly kind: 'fact';
  readonly statement: string;
  readonly subject: string;
  readonly predicate: string;
  readonly object: string;
  readonly entityIds: readonly string[];
  readonly time?: string;
  readonly location?: string;
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
  readonly verification: FactVerification;
  readonly sectionId?: string;
}

export interface EntityNode {
  readonly id: string;
  readonly kind: 'entity';
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly wikidataId?: string;
  readonly entityType?: string;
  readonly mentionCount: number;
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
}

export interface IntentNode {
  readonly id: string;
  readonly kind: 'intent';
  readonly label: string;
  readonly userGoal: string;
  readonly queryVariants: readonly string[];
  readonly priority: number;
  readonly parentId?: string;
  readonly childIds: readonly string[];
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
  readonly primary: boolean;
}

export interface QuestionNode {
  readonly id: string;
  readonly kind: 'question';
  readonly question: string;
  readonly answeredByFactIds: readonly string[];
  readonly answeredBySectionIds: readonly string[];
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
}

export interface TopicNode {
  readonly id: string;
  readonly kind: 'topic';
  readonly label: string;
  readonly cluster?: string;
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
}

export interface SectionNode {
  readonly id: string;
  readonly kind: 'section';
  readonly label: string;
  readonly headingLevel: 1 | 2 | 3 | 4;
  readonly order: number;
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
}

export interface CitationNode {
  readonly id: string;
  readonly kind: 'citation';
  readonly label: string;
  readonly url?: string;
  readonly authority?: number;
  readonly importance: Importance;
  readonly confidence: number;
  readonly status: CoverageStatus;
}

export interface EvidenceSpanNode {
  readonly id: string;
  readonly kind: 'evidence_span';
  readonly blockId: string;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly snippet: string;
  readonly evidenceKind: 'example' | 'date' | 'number' | 'quote' | 'context';
  readonly confidence: number;
  readonly status: CoverageStatus;
}

export type KgNode =
  | FactNode
  | EntityNode
  | IntentNode
  | QuestionNode
  | TopicNode
  | SectionNode
  | CitationNode
  | EvidenceSpanNode;

export interface KgEdge {
  readonly id: string;
  readonly type: KgEdgeType;
  readonly from: string;
  readonly to: string;
  readonly predicate?: string;
  readonly confidence: number;
}

export interface KnowledgeGraph {
  readonly nodes: readonly KgNode[];
  readonly edges: readonly KgEdge[];
}

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

export function isFactNode(n: KgNode): n is FactNode {
  return n.kind === 'fact';
}

export function isEntityNode(n: KgNode): n is EntityNode {
  return n.kind === 'entity';
}

export function isEvidenceSpanNode(n: KgNode): n is EvidenceSpanNode {
  return n.kind === 'evidence_span';
}

export function isIntentNode(n: KgNode): n is IntentNode {
  return n.kind === 'intent';
}

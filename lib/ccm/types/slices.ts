export interface SectionRef {
  readonly blockId: string;
  readonly headingLevel: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly discourseRole?: 'definition' | 'example' | 'consequence' | 'summary' | 'faq' | 'other';
}

export interface StructureSlice {
  readonly sections: readonly SectionRef[];
  readonly readingOrder: readonly string[];
  readonly hasFaq: boolean;
  readonly hasSummary: boolean;
  readonly answersMainQuestionEarly: boolean;
}

export interface RhetoricSignals {
  readonly argumentFlowScore: number;
  readonly problemFirstOpening: boolean;
  readonly encyclopedicLead: boolean;
}

export interface StyleSignals {
  readonly avgSentenceLen?: number;
  readonly passiveRate?: number;
  readonly readingGrade?: number;
}

export interface UxSignals {
  readonly listDensity?: number;
  readonly mediaCount?: number;
  readonly tocFriendly: boolean;
}

export interface PresentationSlice {
  readonly rhetoric: RhetoricSignals;
  readonly style: StyleSignals;
  readonly ux: UxSignals;
}

export interface SeoSignals {
  readonly targetWordCount?: number;
  readonly termPriorIds?: readonly string[];
}

export interface AiSignals {
  readonly aiSearchCheckpointCount?: number;
}

export interface ContentMetadata {
  readonly locale: string;
  readonly title?: string;
  readonly primaryQuery?: string;
  readonly seo: SeoSignals;
  readonly ai: AiSignals;
}

export interface ComponentScore {
  readonly key: string;
  readonly weight: number;
  readonly score: number;
  readonly explain: readonly string[];
  readonly missingNodeIds: readonly string[];
}

export interface CoverageViewSummary {
  readonly overall: number;
  readonly coveredFacts: number;
  readonly totalFacts: number;
  readonly coveredIntents: number;
  readonly totalIntents: number;
}

export interface ContentMetrics {
  readonly contentScore: number;
  readonly components: readonly ComponentScore[];
  readonly coverageView: CoverageViewSummary;
  readonly confidence: number;
}

export interface ContentStatistics {
  readonly nodeCounts: Readonly<Record<string, number>>;
  readonly edgeCounts: Readonly<Record<string, number>>;
  readonly orphanNodeIds: readonly string[];
  readonly duplicateFactGroupIds: readonly string[];
  readonly conflictingFactPairIds: readonly string[];
  readonly avgEvidencePerFact: number;
}

export interface CitationRecord {
  readonly id: string;
  readonly url?: string;
  readonly title?: string;
  readonly authority?: number;
  readonly accessedAt?: string;
}

export interface ReferenceIndex {
  readonly citations: readonly CitationRecord[];
}

export interface EmbeddingIndex {
  readonly model: string;
  readonly dims: number;
  readonly vectors: readonly { nodeId: string; vectorId: string }[];
}

export interface LegacyBridge {
  readonly coverageSnapshotV1: unknown;
}

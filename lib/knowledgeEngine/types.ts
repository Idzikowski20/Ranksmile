/**
 * Knowledge Intelligence — CanonicalClaim / Evidence / immutable KnowledgeGraph.
 * Coverage lives in a separate overlay report — not mutated into the frozen graph.
 */
export type PriorityClass = 'critical' | 'high' | 'medium' | 'low';

export type SourceKind = 'official' | 'industry' | 'competitor' | 'ai_overview' | 'paa';

export type GeneratedFrom = 'serp' | 'official' | 'paa' | 'ai_overview' | 'industry';

export type EvidenceRole = 'official' | 'serp' | 'consensus' | 'ai_overview' | 'paa' | 'planning' | 'validation';

export type ClaimEvidence = {
  kind: SourceKind;
  url: string;
  domain: string;
  favicon: string;
  title: string;
  weight: number;
  roles: readonly EvidenceRole[];
  serpPositions?: readonly number[];
  quote?: string;
};

export type SourceDiversity = {
  readonly official: boolean;
  readonly competitors: boolean;
  readonly aiOverview: boolean;
  readonly paa: boolean;
  /** 0..1 from how many of the four channels are present. */
  readonly score: number;
};

export type ConsensusExplanation = {
  readonly percent: number;
  readonly because: readonly string[];
};

export type CanonicalClaim = {
  id: string;
  statement: string;
  cluster: string;
  importance: PriorityClass;
  /** Learning hook 0–100 (heuristic in MVP). */
  importanceScore: number;
  consensus: number;
  evidence: readonly ClaimEvidence[];
  usedByCompetitors: number;
  competitorsTotal: number;
  usedInSections: readonly string[];
  generatedFrom: readonly GeneratedFrom[];
  sourceDiversity: SourceDiversity;
  consensusExplanation: ConsensusExplanation;
};

export type KnowledgeEntityVote = {
  term: string;
  docsHit: number;
  competitorsTotal: number;
  consensus: number;
  importance: PriorityClass;
  importanceScore: number;
};

export type TopicBlockRole = 'FOUNDATION' | 'ACTION' | 'MONITORING' | 'ADVANCED';

export type TopicBlock = {
  readonly id: string;
  readonly title: string;
  readonly role: TopicBlockRole;
  readonly consensus: number;
  readonly memberHeadings: readonly string[];
  readonly claimIds: readonly string[];
};

export type KnowledgeGapKind = 'consensus_gap' | 'opportunity_gap';

export type KnowledgeGap = {
  readonly id: string;
  readonly kind: KnowledgeGapKind;
  readonly topic: string;
  readonly importance: PriorityClass;
  readonly novelty: number;
  readonly relatedClaimIds: readonly string[];
};

export type CompetitorDocument = {
  url: string;
  title: string;
  score: number;
  authority: number;
  headings: readonly string[];
  entities: readonly string[];
  claimIds: readonly string[];
  topicBlockIds: readonly string[];
  serpPosition: number;
};

export type VerifierIssue = {
  readonly code: string;
  readonly message: string;
};

export type VerifierResult = {
  readonly ok: boolean;
  readonly issues: readonly VerifierIssue[];
};

export type StageTimingsMs = {
  extract: number;
  normalize: number;
  canonicalize: number;
  vote: number;
  cluster: number;
  build: number;
  verify: number;
};

/** Immutable Knowledge Graph — claims and nested evidence are frozen at build time. */
export type KnowledgeGraph = {
  readonly knowledge_version: number;
  readonly claims: readonly CanonicalClaim[];
  readonly entities: readonly KnowledgeEntityVote[];
  readonly topicBlocks: readonly TopicBlock[];
  readonly gaps: readonly KnowledgeGap[];
  readonly competitors: readonly CompetitorDocument[];
  readonly stageTimingsMs: StageTimingsMs;
  readonly verifier: VerifierResult;
};

export type PlannerQualityMetrics = {
  quality: number;
  coverage: number;
  blocks: number;
  claimsUsed: number;
};

export type WriterQualityMetrics = {
  claimsUsed: number;
  claimsTotal: number;
  coveragePct: number;
  words: number;
  sections: number;
};

/** Mutable overlay — never written into frozen KnowledgeGraph claims. */
export type ClaimCoverageStatus = 'covered' | 'partial' | 'missing';

export type ClaimCoverageItem = {
  claimId: string;
  coverage: ClaimCoverageStatus;
  coverageScore: number;
  coverageGaps: string[];
};

export type KnowledgeCoverageReport = {
  items: ClaimCoverageItem[];
  writerMetrics?: WriterQualityMetrics;
};

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
  roles: EvidenceRole[];
  serpPositions?: number[];
  quote?: string;
};

export type SourceDiversity = {
  official: boolean;
  competitors: boolean;
  aiOverview: boolean;
  paa: boolean;
  /** 0..1 from how many of the four channels are present. */
  score: number;
};

export type ConsensusExplanation = {
  percent: number;
  because: string[];
};

export type CanonicalClaim = {
  id: string;
  statement: string;
  cluster: string;
  importance: PriorityClass;
  /** Learning hook 0–100 (heuristic in MVP). */
  importanceScore: number;
  consensus: number;
  evidence: ClaimEvidence[];
  usedByCompetitors: number;
  competitorsTotal: number;
  usedInSections: string[];
  generatedFrom: GeneratedFrom[];
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
  id: string;
  title: string;
  role: TopicBlockRole;
  consensus: number;
  memberHeadings: string[];
  claimIds: string[];
};

export type KnowledgeGapKind = 'consensus_gap' | 'opportunity_gap';

export type KnowledgeGap = {
  id: string;
  kind: KnowledgeGapKind;
  topic: string;
  importance: PriorityClass;
  novelty: number;
  relatedClaimIds: string[];
};

export type CompetitorDocument = {
  url: string;
  title: string;
  score: number;
  authority: number;
  headings: string[];
  entities: string[];
  claimIds: string[];
  topicBlockIds: string[];
  serpPosition: number;
};

export type VerifierIssue = {
  code: string;
  message: string;
};

export type VerifierResult = {
  ok: boolean;
  issues: VerifierIssue[];
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

export type KnowledgeGraph = {
  knowledge_version: number;
  claims: readonly CanonicalClaim[];
  entities: readonly KnowledgeEntityVote[];
  topicBlocks: readonly TopicBlock[];
  gaps: readonly KnowledgeGap[];
  competitors: readonly CompetitorDocument[];
  stageTimingsMs: StageTimingsMs;
  verifier: VerifierResult;
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

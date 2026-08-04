import {
  KNOWLEDGE_CONSENSUS_MIN,
  PLANNER_CLAIMS_FLOOR,
} from './constants';
import type { KnowledgeGraph } from './types';

export type {
  ClaimEvidence,
  CanonicalClaim,
  KnowledgeCoverageReport,
  KnowledgeGraph,
  KnowledgeEntityVote,
  TopicBlock,
  KnowledgeGap,
  CompetitorDocument,
  VerifierResult,
  StageTimingsMs,
  PlannerQualityMetrics,
  WriterQualityMetrics,
  SourceKind,
  GeneratedFrom,
  SourceDiversity,
  ConsensusExplanation,
  TopicBlockRole,
  KnowledgeGapKind,
  ClaimCoverageStatus,
  ClaimCoverageItem,
  PriorityClass,
  EvidenceRole,
} from './types';

export {
  KNOWLEDGE_SCHEMA_VERSION,
  KNOWLEDGE_CONSENSUS_MIN,
  PLANNER_CLAIMS_FLOOR,
  CANONICALIZE_SIM_MIN,
  SOURCE_TIER_WEIGHTS,
  OFFICIAL_DOMAINS,
  MAX_CLAIMS_PER_SECTION,
} from './constants';

export { getEmbeddingProvider } from './embeddingProvider';
export type { EmbeddingProvider } from './embeddingProvider';
export { semanticMatchScore } from './semanticMatch';
export { buildCompetitorDocuments, headingTextsFromOutline } from './competitorDocument';
export { extractRawKnowledge, normalizeCandidates, isLocalLeftoverEntity } from './extract';
export { canonicalizeClaims, sentencesToCanonicalizeInputs } from './canonicalize';
export { voteClaims } from './vote';
export { buildTopicBlocks, discoverGaps, inferTopicRole } from './cluster';
export { buildKnowledgeGraph, voteEntities } from './buildGraph';
export { verifyKnowledgeGraph } from './verify';
export { runKnowledgeEngine } from './runKnowledgeEngine';
export type { RunKnowledgeEngineInput, RunKnowledgeEngineResult } from './runKnowledgeEngine';
export { knowledgeGraphToTargetKg } from './toTargetKg';
export {
  computeClaimCoverage,
  coverageStatusForClaim,
  applyKnowledgeCoverageOverlay,
} from './coverage';
export type { CoverageOverlayResult } from './coverage';
export { patchExecutionPlanFromCoverage, plansDiffer } from './aoPlanPatch';
export type { AoPlanPatchResult } from './aoPlanPatch';

export function shouldUseKnowledgePlanner(
  graph: KnowledgeGraph | null,
  flag: boolean,
): { use: boolean; reason: 'flag_off' | 'below_floor' | 'verifier_fail' | 'ok' } {
  if (!flag) return { use: false, reason: 'flag_off' };
  if (!graph || !graph.verifier.ok) return { use: false, reason: 'verifier_fail' };
  const n = graph.claims.filter((c) => c.consensus >= KNOWLEDGE_CONSENSUS_MIN).length;
  if (n < PLANNER_CLAIMS_FLOOR) return { use: false, reason: 'below_floor' };
  return { use: true, reason: 'ok' };
}

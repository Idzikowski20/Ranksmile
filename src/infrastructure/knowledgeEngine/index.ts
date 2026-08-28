import {
  KNOWLEDGE_CONSENSUS_MIN,
  PLANNER_CLAIMS_FLOOR,
} from '@/src/core/domain/knowledgeEngine/constants';
import type { KnowledgeGraph } from '@/src/core/domain/knowledgeEngine/types';

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
} from '@/src/core/domain/knowledgeEngine/types';

export {
  KNOWLEDGE_SCHEMA_VERSION,
  KNOWLEDGE_CONSENSUS_MIN,
  PLANNER_CLAIMS_FLOOR,
  CANONICALIZE_SIM_MIN,
  SOURCE_TIER_WEIGHTS,
  OFFICIAL_DOMAINS,
  MAX_CLAIMS_PER_SECTION,
} from '@/src/core/domain/knowledgeEngine/constants';

export { getEmbeddingProvider } from '@/src/core/domain/knowledgeEngine/embeddingProvider';
export type { EmbeddingProvider } from '@/src/core/domain/knowledgeEngine/embeddingProvider';
export { semanticMatchScore } from '@/src/core/domain/knowledgeEngine/semanticMatch';
export { buildCompetitorDocuments, headingTextsFromOutline } from '@/src/infrastructure/knowledgeEngine/competitorDocument';
export { extractRawKnowledge, normalizeCandidates, isLocalLeftoverEntity } from '@/src/core/domain/knowledgeEngine/extract';
export { canonicalizeClaims, sentencesToCanonicalizeInputs } from '@/src/infrastructure/knowledgeEngine/canonicalize';
export { voteClaims } from '@/src/core/domain/knowledgeEngine/vote';
export { buildTopicBlocks, discoverGaps, inferTopicRole } from '@/src/infrastructure/knowledgeEngine/cluster';
export { buildKnowledgeGraph, voteEntities } from '@/src/core/domain/knowledgeEngine/buildGraph';
export { verifyKnowledgeGraph } from '@/src/core/domain/knowledgeEngine/verify';
export { runKnowledgeEngine } from '@/src/infrastructure/knowledgeEngine/runKnowledgeEngine';
export type { RunKnowledgeEngineInput, RunKnowledgeEngineResult } from '@/src/infrastructure/knowledgeEngine/runKnowledgeEngine';
export { knowledgeGraphToTargetKg } from '@/src/core/domain/knowledgeEngine/toTargetKg';
export {
  computeClaimCoverage,
  coverageStatusForClaim,
  applyKnowledgeCoverageOverlay,
} from '@/src/infrastructure/knowledgeEngine/coverage';
export type { CoverageOverlayResult } from '@/src/infrastructure/knowledgeEngine/coverage';
export { patchExecutionPlanFromCoverage, plansDiffer } from '@/src/infrastructure/knowledgeEngine/aoPlanPatch';
export type { AoPlanPatchResult } from '@/src/infrastructure/knowledgeEngine/aoPlanPatch';

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

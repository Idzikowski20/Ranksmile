export type { CoverageStatus, Importance, FactVerification, ContentProfileId } from '@/src/core/ccm/types/status';
export type {
  AstBlockType,
  AstBlock,
  LexicalAst,
  DiscourseRole,
  ClaimCandidate,
  DiscourseSpan,
  SemanticAst,
} from '@/src/core/ccm/types/ast';
export type {
  SemanticCandidateKind,
  SemanticCandidateBase,
  EntityCandidate,
  FactCandidate,
  RelationCandidate,
  IntentCandidate,
  QuestionCandidate,
  TopicCandidate,
  SemanticCandidate,
  IrParagraph,
  IrClaim,
  ContentIr,
} from '@/src/core/ccm/types/ir';
export type {
  KgEdgeType,
  KgNodeKind,
  FactNode,
  EntityNode,
  IntentNode,
  QuestionNode,
  TopicNode,
  SectionNode,
  CitationNode,
  EvidenceSpanNode,
  KgNode,
  KgEdge,
  KnowledgeGraph,
  GraphIndexes,
} from '@/src/core/ccm/types/graph';
export { isFactNode, isEntityNode, isEvidenceSpanNode, isIntentNode } from '@/src/core/ccm/types/graph';
export type { ReasoningNodeKind, ReasoningNode, ReasoningEdge, ReasoningGraph } from '@/src/core/ccm/types/reasoning';
export type {
  SectionRef,
  StructureSlice,
  RhetoricSignals,
  StyleSignals,
  UxSignals,
  PresentationSlice,
  SeoSignals,
  AiSignals,
  ContentMetadata,
  ComponentScore,
  CoverageViewSummary,
  ContentMetrics,
  ContentStatistics,
  CitationRecord,
  ReferenceIndex,
  EmbeddingIndex,
  LegacyBridge,
} from '@/src/core/ccm/types/slices';
export type {
  CompilerStageId,
  CompilerCapabilities,
  TokenUsage,
  CostEstimate,
  CompilerMetadata,
} from '@/src/core/ccm/types/compilerMeta';
export type { CcmSchemaVersion, KnowledgeSlice, CanonicalContentModel } from '@/src/core/ccm/types/ccm';
export type { SubjectId, PredicateId, ObjectId } from '@/src/core/ccm/types/ids';
export type { RecommendationExpectations, RecommendationOp } from '@/src/core/ccm/types/recommendationDsl';
export type { EditActionKind, EditAction, ActionGraph } from '@/src/core/ccm/types/actionGraph';

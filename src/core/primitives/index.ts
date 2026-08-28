export type {
  Action,
  ActionAppliesTo,
  ActionCost,
  ActionDifficulty,
  ActionExecution,
  ActionExecutionStatus,
  ActionImpact,
  ActionOrigin,
  ActionType,
  Capability,
  CapabilityId,
  DomainEvent,
  DomainEventType,
  EvidenceRef,
  ExperimentRef,
  Feature,
  KnowledgeEdge,
  KnowledgeLayerStub,
  KnowledgeNode,
  KnowledgeNodeKind,
  MissingItem,
  MissingItemType,
  Observation,
  ObservationKind,
  ObservationSource,
  PipelineVersions,
  ScoreContributor,
  ScoreDistribution,
  ScoreVector,
  Signal,
  SourceReliability,
  StageResult,
  Strategy,
  StrategyId,
  VisibilityFacets,
} from '@/src/core/primitives/types';

export { prioritizeActions, applyStrategy } from '@/src/core/primitives/prioritizeActions';
export { guidelineToAction, guidelinesToActions } from '@/src/core/primitives/guidelineToAction';
export { DOMAIN_EVENT_TYPES, makeDomainEvent } from '@/src/core/primitives/events';
export {
  FeatureRegistry,
  defaultFeatureRegistry,
  type FeatureContext,
  type FeatureProducer,
  type FeatureRegistration,
} from '@/src/core/primitives/featureRegistry';
export { PLATFORM_CAPABILITIES, listCapabilities, getCapability } from '@/src/core/primitives/capabilities';
export { emptyKnowledgeLayer, buildKnowledgeLayer } from '@/src/core/primitives/knowledgeLayer';
export {
  pendingExecution,
  executeAction,
  pickExecutor,
  listExecutors,
  manualExecutor,
  llmExecutor,
  wpPluginExecutor,
  cmsExecutor,
  type ActionExecutor,
} from '@/src/core/primitives/actionExecutor';
export {
  assignExperimentBucket,
  withExperiment,
  stableUnitInterval,
  COVERAGE_EXPERIMENT,
  type ExperimentDefinition,
} from '@/src/core/primitives/experiments';

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
} from './types';

export { prioritizeActions, applyStrategy } from './prioritizeActions';
export { guidelineToAction, guidelinesToActions } from './guidelineToAction';
export { DOMAIN_EVENT_TYPES, makeDomainEvent } from './events';
export {
  FeatureRegistry,
  defaultFeatureRegistry,
  type FeatureContext,
  type FeatureProducer,
  type FeatureRegistration,
} from './featureRegistry';
export { PLATFORM_CAPABILITIES, listCapabilities, getCapability } from './capabilities';
export { emptyKnowledgeLayer, buildKnowledgeLayer } from './knowledgeLayer';
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
} from './actionExecutor';
export {
  assignExperimentBucket,
  withExperiment,
  stableUnitInterval,
  COVERAGE_EXPERIMENT,
  type ExperimentDefinition,
} from './experiments';

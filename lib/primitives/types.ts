/** Shared growth-loop primitives — Semrush-style platform data model (Q1 close). */

export type MissingItemType =
  | 'topic'
  | 'question'
  | 'entity'
  | 'intent'
  | 'section'
  | 'citation'
  | 'source'
  | 'example'
  | 'definition'
  | 'faq'
  | 'statistic';

export type MissingItem = {
  id: string;
  type: MissingItemType | string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  score?: number;
  confidence?: number;
  targetId?: string;
};

/** Raw fact from any analytics module before Feature interpretation. */
export type ObservationSource =
  | 'serp'
  | 'ai_visibility'
  | 'gsc'
  | 'rank'
  | 'organic'
  | 'coverage'
  | 'audit'
  | 'competitors'
  | 'internal_links'
  | 'topical_map'
  | 'backlinks'
  | 'entity_graph'
  | string;

export type ObservationKind =
  | 'missing_topic'
  | 'missing_faq'
  | 'missing_entity'
  | 'low_ctr'
  | 'low_entity_coverage'
  | 'competitor_gained_snippet'
  | 'visibility_drop'
  | 'coverage_gap'
  | 'audit_issue'
  | string;

export type Observation = {
  id: string;
  kind: ObservationKind;
  source: ObservationSource;
  /** ISO timestamp — observations are append-only facts. */
  observedAt: string;
  domainId?: number;
  articleId?: number;
  title: string;
  detail?: string;
  severity?: 'low' | 'medium' | 'high';
  score?: number;
  confidence?: number;
  evidence?: EvidenceRef[];
  relatedTopicIds?: string[];
  relatedEntityIds?: string[];
  relatedQuestionIds?: string[];
  payload?: Record<string, unknown>;
};

export type ActionCost = 'easy' | 'medium' | 'large';
export type ActionDifficulty = 'trivial' | 'moderate' | 'hard';
export type ActionImpact = 'low' | 'medium' | 'high';

export type ActionType =
  | 'add_faq'
  | 'rewrite_section'
  | 'expand_section'
  | 'add_entity'
  | 'add_internal_link'
  | 'fix_heading'
  | 'cover_question'
  | 'create_outline'
  | 'generate_brief'
  | 'publish'
  | 'custom'
  | string;

export type ActionOrigin =
  | 'coverage'
  | 'visibility'
  | 'planner'
  | 'audit'
  | 'performance'
  | 'recs'
  | string;

export type ActionAppliesTo = {
  kind: 'article' | 'domain' | 'section' | 'paragraph' | 'entity' | 'topic';
  id?: string;
};

export type Action = {
  id: string;
  type: ActionType;
  title: string;
  instruction: string;
  expectedLift: number;
  confidence: number;
  cost: ActionCost;
  difficulty?: ActionDifficulty;
  impact?: ActionImpact;
  priority?: number;
  reason: string;
  origin: ActionOrigin;
  appliesTo: ActionAppliesTo;
  /** Soft deps (capability / outline.exists). */
  requires?: string[];
  /** Hard deps on other Action ids. */
  dependsOn?: string[];
  generatedBy?: string;
  featureId?: string;
  observationIds?: string[];
  evidence?: EvidenceRef[];
  relatedEntities?: string[];
  relatedTopics?: string[];
  relatedQuestions?: string[];
};

export type ScoreContributor = { id: string; label: string; delta: number };

export type ScoreDistribution = {
  min?: number;
  max?: number;
  median?: number;
  p25?: number;
  p75?: number;
  variance?: number;
  topContributorId?: string;
};

export type ScoreVector = {
  /** Prefer `value`; `score` kept for backward compat. */
  score: number;
  value?: number;
  confidence: number;
  version: number;
  explainability?: string;
  explanation?: string;
  contributors: ScoreContributor[];
  components?: Record<string, number>;
  weights?: Record<string, number>;
  rawSignals?: Record<string, number>;
  distribution?: ScoreDistribution;
  history?: Array<{ at: string; score: number }>;
};

export type EvidenceRef = {
  engine?: string;
  prompt?: string;
  rank?: number;
  url?: string;
  rawText?: string;
  reliability?: number;
  freshness?: number;
};

export type Signal = {
  id: string;
  key: string;
  value: number | string;
  evidence?: EvidenceRef[];
};

/**
 * Immutable feature snapshot — never mutate; append new versions.
 * Treat like an event keyed by (id, version, createdAt, snapshotId).
 */
export type Feature = {
  id: string;
  version: number;
  createdAt: string;
  snapshotId?: string;
  score: ScoreVector;
  confidence: number;
  signals: Signal[];
  actions: Action[];
  observationIds?: string[];
  /** @deprecated do not mutate — use new Feature versions instead */
  history?: unknown[];
};

export type KnowledgeNodeKind =
  | 'topic'
  | 'intent'
  | 'question'
  | 'entity'
  | 'page'
  | 'action'
  | 'outcome'
  | 'competitor'
  | 'prompt'
  | string;

export type KnowledgeNode = {
  id: string;
  type: KnowledgeNodeKind;
  label: string;
  meta?: Record<string, unknown>;
};

export type KnowledgeEdge = {
  from: string;
  to: string;
  rel: string;
  weight?: number;
};

/** Knowledge Layer chain: Topic → Intent → Questions → Entities → Pages → Actions → Results. */
export type KnowledgeLayerStub = {
  topics: KnowledgeNode[];
  intents: KnowledgeNode[];
  questions: KnowledgeNode[];
  entities: KnowledgeNode[];
  pages: KnowledgeNode[];
  actions: KnowledgeNode[];
  outcomes: KnowledgeNode[];
  edges: KnowledgeEdge[];
};

export type DomainEventType =
  | 'SnapshotCreated'
  | 'CoverageUpdated'
  | 'VisibilityUpdated'
  | 'ScoreChanged'
  | 'RecommendationAccepted'
  | 'RecommendationRejected'
  | 'ArticlePublished'
  | 'ObservationRecorded'
  | 'FeatureComputed'
  | 'ActionExecuted';

export type DomainEvent = {
  type: DomainEventType;
  at: string;
  domainId?: number;
  articleId?: number;
  payload?: Record<string, unknown>;
};

export type StrategyId = 'quick_wins' | 'ai_visibility_focus' | 'content_score_focus' | 'timeboxed';

export type Strategy = {
  id: StrategyId;
  label: string;
  maxActions?: number;
  maxMinutes?: number;
};

export type StageResult<TIn = unknown, TOut = unknown> = {
  name: string;
  input: TIn;
  output: TOut;
  stats: Record<string, number | string>;
  durationMs: number;
  version: string | number;
};

export type PipelineVersions = {
  schemaVersion: number;
  pipelineVersion: number;
  scoringVersion: number;
  experimentId?: string;
  experimentVariant?: string;
  experimentBucket?: string;
};

/** A/B / experiment metadata on pipelines and scoring. */
export type ExperimentRef = {
  id: string;
  variant: string;
  bucket: string;
};

export type SourceReliability = {
  weight: number;
  reliability: number;
  freshness?: number;
  variance?: number;
};

export type CapabilityId =
  | 'create_outline'
  | 'rewrite_section'
  | 'generate_faq'
  | 'cluster_entities'
  | 'suggest_internal_links'
  | 'analyze_competitors'
  | 'generate_brief'
  | 'run_auto_optimize'
  | 'publish_wordpress'
  | string;

export type Capability = {
  id: CapabilityId;
  label: string;
  description: string;
  /** Action types this capability can execute. */
  actionTypes: ActionType[];
  available: boolean;
};

export type ActionExecutionStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export type ActionExecution = {
  actionId: string;
  status: ActionExecutionStatus;
  executor: 'llm' | 'wp_plugin' | 'cms' | 'manual' | string;
  startedAt?: string;
  finishedAt?: string;
  resultRef?: string;
  error?: string;
};

/** AI Visibility score facets (not a single number forever). */
export type VisibilityFacets = {
  exposure?: number;
  presence?: number;
  authority?: number;
  coverage?: number;
  trust?: number;
  citation?: number;
};

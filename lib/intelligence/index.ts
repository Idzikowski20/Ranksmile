/**
 * Intelligence zone — Judge / ModelDiff / Benchmark / ConsumerContext / WI / history.
 */
export {
  diffModels,
  type ModelDiff,
  type AstDiff,
  type GraphDiff,
  type ScoreDiff,
  type RecommendationDiff,
  type DiffModelsOpts,
} from './modelDiff';
export {
  judgeModels,
  type JudgeVerdict,
  type JudgeVerdictKind,
  type JudgeOpts,
  type ExpectationResult,
} from './judge';
export {
  createConsumerContext,
  type ConsumerContext,
  type ConsumerId,
  type ConsumerResult,
  type ContentConsumer,
  type CompileEvent,
  type ActionBudget,
  type PeerResults,
  type RuntimeHandle,
  type CreateContextOpts,
} from './consumerContext';
export {
  runBenchmark,
  benchmarkConsumer,
  DEFAULT_BENCHMARK_PATTERNS,
  type BenchmarkReport,
  type BenchmarkGap,
} from './benchmark';
export {
  coverageConsumer,
  visibilityConsumer,
  actionGraphConsumer,
  judgeConsumer,
} from './consumers';
export {
  InMemoryCompileStore,
  createHistoryConsumer,
  acceptHistoryAsync,
  ccmToBlob,
  ccmFromBlob,
  type HistoryAppendAck,
  type StoredArticleCompile,
  type CompileStore,
} from './compileStore';
export {
  buildWiScorecard,
  writingIntelligenceConsumer,
  editorialIntelligenceConsumer,
  optimizationIntelligenceConsumer,
  type WiScorecard,
  type WiDimension,
  type EditorialScorecard,
  type OptimizationScorecard,
} from './writingIntelligence';
export {
  compileArticle,
  getCcm,
  projectArticleIntelligence,
  resolveCompileSource,
  type ArticleIntelligenceView,
  type CompileArticleOpts,
  type CompileArticleResult,
  type ArticleSourceInput,
} from './runtimeApi';
export {
  buildInfoToCoverFromCcm,
  preferCcmInfoToCover,
  type CcmInfoToCover,
} from './ccmToInfoToCover';
export {
  projectCcmToCoverageSnapshot,
} from './ccmToCoverageSnapshot';
export {
  enrichCcmWithDaFacts,
} from './enrichCcmWithDaFacts';
export {
  citationsToDaFactSeeds,
  loadDaFactSeeds,
  type DaFactSeed,
} from './loadDaFactSeeds';
export {
  applyContradictHeuristics,
} from './applyContradictHeuristics';
export {
  applyLlmGapEvidence,
} from './applyLlmGapEvidence';
export {
  getCcmCompileMetricsSummary,
  recordCcmCompileMetric,
  type CcmCompileMetric,
  type CcmCompileOutcome,
} from './ccmCompileMetrics';
export {
  applyLivePresence,
  type LivePresenceResult,
} from './livePresence';
export {
  summarizeRecommendations,
  recommendationKindLabel,
  type CcmRecommendation,
} from './ccmRecommendations';
export {
  runCcmCompileCron,
  listCcmCompileCandidates,
  type RunCcmCompileCronOpts,
  type RunCcmCompileCronResult,
  type CcmCronCandidate,
} from './ccmStaleCron';
export {
  ccmRecommendationsToEditCandidates,
  type CcmToEditCandidatesOpts,
} from './ccmToEditCandidates';
export { loadCcmEditCandidatesForArticle } from './loadCcmEditCandidates';
/** SqlCompileStore: import from `lib/intelligence/sqlCompileStore` (pulls DB). */


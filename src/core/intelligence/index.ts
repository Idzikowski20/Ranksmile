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
} from '@/src/core/intelligence/modelDiff';
export {
  judgeModels,
  type JudgeVerdict,
  type JudgeVerdictKind,
  type JudgeOpts,
  type ExpectationResult,
} from '@/src/core/intelligence/judge';
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
} from '@/src/core/intelligence/consumerContext';
export {
  runBenchmark,
  benchmarkConsumer,
  DEFAULT_BENCHMARK_PATTERNS,
  type BenchmarkReport,
  type BenchmarkGap,
} from '@/src/core/intelligence/benchmark';
export {
  coverageConsumer,
  visibilityConsumer,
  actionGraphConsumer,
  judgeConsumer,
} from '@/src/core/intelligence/consumers';
export {
  InMemoryCompileStore,
  createHistoryConsumer,
  acceptHistoryAsync,
  ccmToBlob,
  ccmFromBlob,
  type HistoryAppendAck,
  type StoredArticleCompile,
  type CompileStore,
} from '@/src/core/intelligence/compileStore';
export {
  buildWiScorecard,
  writingIntelligenceConsumer,
  editorialIntelligenceConsumer,
  optimizationIntelligenceConsumer,
  type WiScorecard,
  type WiDimension,
  type EditorialScorecard,
  type OptimizationScorecard,
} from '@/src/core/intelligence/writingIntelligence';
export {
  compileArticle,
  getCcm,
  projectArticleIntelligence,
  resolveCompileSource,
  type ArticleIntelligenceView,
  type CompileArticleOpts,
  type CompileArticleResult,
  type ArticleSourceInput,
} from '@/src/core/intelligence/runtimeApi';
export {
  buildInfoToCoverFromCcm,
  preferCcmInfoToCover,
  type CcmInfoToCover,
} from '@/src/core/intelligence/ccmToInfoToCover';
export {
  projectCcmToCoverageSnapshot,
} from '@/src/core/intelligence/ccmToCoverageSnapshot';
export {
  enrichCcmWithDaFacts,
} from '@/src/core/intelligence/enrichCcmWithDaFacts';
export {
  citationsToDaFactSeeds,
  loadDaFactSeeds,
  type DaFactSeed,
} from '@/src/core/intelligence/loadDaFactSeeds';
export {
  applyContradictHeuristics,
} from '@/src/core/intelligence/applyContradictHeuristics';
export {
  applyLlmGapEvidence,
} from '@/src/core/intelligence/applyLlmGapEvidence';
export {
  getCcmCompileMetricsSummary,
  recordCcmCompileMetric,
  type CcmCompileMetric,
  type CcmCompileOutcome,
} from '@/src/core/intelligence/ccmCompileMetrics';
export {
  applyLivePresence,
  type LivePresenceResult,
} from '@/src/core/intelligence/livePresence';
export {
  summarizeRecommendations,
  recommendationKindLabel,
  type CcmRecommendation,
} from '@/src/core/intelligence/ccmRecommendations';
export {
  runCcmCompileCron,
  listCcmCompileCandidates,
  type RunCcmCompileCronOpts,
  type RunCcmCompileCronResult,
  type CcmCronCandidate,
} from '@/src/core/intelligence/ccmStaleCron';
export {
  ccmRecommendationsToEditCandidates,
  type CcmToEditCandidatesOpts,
} from '@/src/core/intelligence/ccmToEditCandidates';
export { loadCcmEditCandidatesForArticle } from '@/src/core/intelligence/loadCcmEditCandidates';
/** SqlCompileStore: import from `lib/intelligence/sqlCompileStore` (pulls DB). */

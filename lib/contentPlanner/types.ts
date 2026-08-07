/**
 * Content Planner v2 — Content Operating System contracts.
 * Pre-write planning; CCM remains post-write SoT.
 */

export type KnowledgeLevel = 'low' | 'medium' | 'high';
export type ArticleType =
  | 'step-by-step'
  | 'checklist'
  | 'comparison'
  | 'guide'
  /**
   * Hiring intent — "prywatny detektyw warszawa", "adwokat rozwodowy kraków". The reader
   * is choosing a provider, not learning a subject, and the pages that rank are service
   * pages. Planning these as a guide produced a how-to for a query nobody asks how-to
   * about.
   */
  | 'service'
  | 'faq-first'
  | 'case-study';

export type ClaimImportance = 'required' | 'nice_to_have' | 'optional';
export type GainClass = 'core' | 'expected' | 'opportunity';
export type PriorityClass = 'critical' | 'high' | 'medium' | 'low';
export type FreshnessTier = 'high' | 'medium' | 'low';
export type CoverageQuality = 'covered' | 'partial' | 'missing';
export type ContentBlockType =
  | 'definition'
  | 'steps'
  | 'checklist'
  | 'example'
  | 'warning'
  | 'table'
  | 'quote'
  | 'faq'
  | 'comparison'
  | 'pro_tip'
  | 'summary';

export type IntentBlueprint = {
  keyword: string;
  primaryIntent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  articleType: ArticleType;
  first60sQuestions: string[];
  narrativePreference: 'problem_solution' | 'step_by_step' | 'faq_first';
  /** When false, brand niche must not drive H2/entities. */
  allowBrandNiche: boolean;
  yearHint: number;
};

export type ReaderModel = {
  keyword: string;
  readerPersona: string;
  goal: string;
  timeBudgetMinutes: number;
  knowledgeLevel: KnowledgeLevel;
  desiredOutcome: string;
  tone: string;
  articleType: ArticleType;
  fears: string[];
  expectedCta: string;
  /** Content language for localized outline labels (pl|en). */
  language?: 'pl' | 'en';
};

export type CompetitorProfile = {
  url: string;
  position: number;
  authority: number;
  wordCount: number;
  paragraphs: number;
  headings: number;
  images: number;
  tables: number;
  lists: number;
  faq: number;
  examples: number;
  caseStudies: number;
  claims: string[];
  questions: string[];
  entities: string[];
  sources: string[];
  statistics: string[];
  openingPattern: 'problem_first' | 'definition_first' | 'unknown';
  closingPattern: 'summary' | 'cta' | 'faq' | 'unknown';
};

/** Structural TOP-N synthesis (distinct from WIE LLM brief). */
export type CompetitorSynthesisMetrics = {
  competitorCount: number;
  averageWords: number;
  medianWords: number;
  recommendedWords: number;
  averageH2: number;
  averageParagraphs: number;
  averageLists: number;
  averageTables: number;
  averageImages: number;
  averageFaqs: number;
  averageClaims: number;
  averageExamples: number;
  averageQuestions: number;
  commonHeadings: string[];
  commonQuestions: string[];
  commonEntities: string[];
  commonClaims: string[];
  missingTopics: string[];
};

export type CompetitorBenchmark = {
  averageWords: number;
  bestWords: number;
  averageH2: number;
  averageParagraphs: number;
  averageLists: number;
  averageTables: number;
  averageImages: number;
  averageFaq: number;
  averageClaims: number;
  averageExamples: number;
  averageQuestions: number;
  targetWords: number;
  targetH2: number;
  /** Shared competitor H2 labels (when available from outlines). */
  commonHeadings?: string[];
};

export type ClaimSource = {
  url: string;
  label: string;
  confidence: number;
};

export type TargetClaim = {
  id: string;
  statement: string;
  topic: string;
  type: 'fact' | 'stat' | 'tool' | 'mistake' | 'faq' | 'definition' | 'example';
  importance: ClaimImportance;
  gainClass: GainClass;
  priority: PriorityClass;
  sources: ClaimSource[];
  citationHint?: string;
};

export type TargetQuestion = {
  id: string;
  question: string;
  requiredAnswerBrief: string;
  importance: ClaimImportance;
  priority: PriorityClass;
  answeredByClaimIds: string[];
  status: CoverageQuality;
};

export type TargetKnowledgeGraph = {
  claims: TargetClaim[];
  questions: TargetQuestion[];
  entities: string[];
};

export type ArticleBudget = {
  words: number;
  paragraphs: number;
  h2: number;
  lists: number;
  tables: number;
  images: number;
  claims: number;
  questions: number;
  examples: number;
  warnings: number;
  checklists: number;
  comparisons: number;
  faq: number;
};

export type SectionBudget = {
  words: number;
  claims: number;
  entities: number;
  questions: number;
  examples: number;
  lists: number;
  tables: number;
  images: number;
  faq: number;
  citations: number;
};

export type ArticleBlueprint = {
  targetWords: number;
  targetH2: number;
  targetParagraphs: number;
  targetLists: number;
  targetTables: number;
  targetImages: number;
  targetFaqs: number;
  targetClaims: number;
  targetQuestions: number;
  targetExamples: number;
  targetChecklists: number;
  requiredSections: string[];
  freshness: FreshnessTier;
  budget: ArticleBudget;
};

export type OutlineSection = {
  id: string;
  heading: string;
  role: string;
  importance: number;
  assignedClaimIds: string[];
  assignedQuestionIds: string[];
  requiredBlocks: ContentBlockType[];
  expectedWords: number;
  evidenceNeeds: Array<'example' | 'statistic' | 'case' | 'source'>;
  freshnessNotes: string[];
  sectionBudget: SectionBudget;
};

export type AdaptiveOutline = {
  h1: string;
  sections: OutlineSection[];
  narrativeOrder: string[];
};

export type SectionWriterHints = {
  previousSection: string | null;
  nextSection: string | null;
  transition: string;
  tone: string;
  avoidRepeating: string[];
};

export type SectionBrief = {
  sectionId: string;
  heading: string;
  objective: string;
  claimIds: string[];
  questionIds: string[];
  blocks: ContentBlockType[];
  evidence: Array<{ kind: 'example' | 'statistic' | 'case' | 'source'; hint: string }>;
  budget: SectionBudget;
  freshnessNotes: string[];
  /** Questions this section must answer (Writer must not invent). */
  mustAnswer: string[];
  sectionPriority: PriorityClass;
  writerHints: SectionWriterHints;
  /** Explainability — why this section exists / which claims. */
  reason?: {
    summary: string;
    signals: string[];
  };
};

/** Assignment coverage for Plan Validator (gate ≥ 95%). */
export type KnowledgeCoverageSlice = {
  total: number;
  assigned: number;
  pct: number;
};

export type KnowledgeCoverageReport = {
  criticalClaims: KnowledgeCoverageSlice;
  questions: KnowledgeCoverageSlice;
  evidenceNeeds: KnowledgeCoverageSlice;
  /** Min of the three slices (gate uses this). */
  knowledgeCoveragePct: number;
};

export type ExecutionPlanClaim = {
  id: string;
  statement: string;
  sources: ClaimSource[];
};

export type ExecutionPlanSection = {
  id: string;
  heading: string;
  objective: string;
  priority: PriorityClass;
  expectedWords: number;
  claims: ExecutionPlanClaim[];
  entities: string[];
  questions: string[];
  mustAnswer: string[];
  evidence: Array<{ kind: string; hint: string }>;
  blocks: ContentBlockType[];
  budget: SectionBudget;
  writerHints: SectionWriterHints;
  reason?: {
    summary: string;
    signals: string[];
  };
};

/**
 * Immutable Write Engine contract (Python monolith PR1, Section Writer PR2,
 * later AO / Rewrite / Humanizer). Built only after Plan Validator passes.
 */
export type ArticleExecutionPlan = {
  schemaVersion: 2;
  plannerVersion: string;
  planHash: string;
  keyword: string;
  title: string;
  narrative: IntentBlueprint['narrativePreference'];
  quickAnswer: string;
  reader: {
    persona: string;
    goal: string;
    tone: string;
    timeBudgetMinutes: number;
  };
  articleBudget: ArticleBudget;
  benchmark: CompetitorBenchmark;
  knowledgeCoverage: KnowledgeCoverageReport;
  requiredCoverage: {
    claims: number;
    questions: number;
    entities: number;
    evidence: number;
    examples: number;
  };
  sections: ExecutionPlanSection[];
  builtAt: string;
};

export type ValidationIssue = {
  code: string;
  message: string;
  missing?: number;
};

export type ValidationResult = {
  ok: boolean;
  issues: ValidationIssue[];
};

export type RewriteStep = {
  sectionId: string;
  action: 'add_claims' | 'add_questions' | 'add_checklist' | 'rewrite_intro' | 'merge' | 'add_evidence';
  count?: number;
  detail: string;
};

export type RewritePlan = {
  steps: RewriteStep[];
};

export type ContentPlannerBundle = {
  schemaVersion: 1 | 2;
  keyword: string;
  intent: IntentBlueprint;
  reader: ReaderModel;
  competitorSynthesis: CompetitorSynthesisMetrics;
  benchmark: CompetitorBenchmark;
  targetKg: TargetKnowledgeGraph;
  blueprint: ArticleBlueprint;
  outline: AdaptiveOutline | null;
  briefs: SectionBrief[];
  rewritePlan: RewritePlan | null;
  /** LLM quick answer (action-first). Empty until enrich / generate. */
  quickAnswer: string | null;
  knowledgeCoverage: KnowledgeCoverageReport | null;
  executionPlan: ArticleExecutionPlan | null;
  builtAt: string;
};

export const MAX_OUTLINE_IMPROVE_ITERS = 3;
export const MAX_BRIEF_IMPROVE_ITERS = 3;
export const PLANNER_VERSION = '2.0.0';
/** Plan Validator: Knowledge Coverage must be ≥ this percent. */
export const KNOWLEDGE_COVERAGE_MIN_PCT = 95;
/** Floor when competitor scrape is empty / thin. */
export const BENCHMARK_WORDS_FLOOR = 2200;
export const BENCHMARK_H2_FLOOR = 7;

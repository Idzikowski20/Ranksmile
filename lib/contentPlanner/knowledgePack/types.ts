export const PIPELINE_COMPONENT_VERSIONS = {
  planner: '2',
  compiler: '1',
  validator: '1',
  writer: '1',
  judge: '1',
  renderer: '1',
} as const;

export type PipelineManifest = {
  plannerVersion: string;
  compilerVersion: string;
  validatorVersion: string;
  writerVersion: string;
  judgeVersion: string;
  rendererVersion: string;
  compiledAt: string; // ISO
};

export type Source = {
  id: string;
  url: string;
  domain: string;
  authority: number;
  language: string;
  title: string;
  summary: string;
  claimIds: string[];
  entityIds: string[];
  quotes: string[];
};

export type ClaimStatus = 'raw' | 'normalized' | 'verified';

export type Claim = {
  id: string;
  text: string;
  sourceId: string | null;
  confidence: number;
  status: ClaimStatus;
};

export type Fact = {
  id: string;
  claimId: string;
  statement: string;
  confidence: number;
};

export type Entity = {
  id: string;
  name: string;
  kind: 'person' | 'place' | 'organization' | 'concept' | 'legal' | 'statistic' | 'other';
  aliases: string[];
};

export type Question = { id: string; text: string };

export type ExampleRef = { id: string; hint: string };
export type ClaimRef = { claimId: string };
export type FactRef = { factId: string };
export type EntityRef = { entityId: string };
export type QuestionRef = { questionId: string };
export type SourceRef = { sourceId: string };

export type TermUsage = {
  term: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  minOccurrences: number;
  maxOccurrences: number;
  preferredParagraphs: string[];
  required: boolean;
  actualOccurrences: number | null;
};

export type ConstraintScope = 'paragraph' | 'section' | 'article';

export type WriterConstraint = {
  type:
    | 'NoBrandMention'
    | 'NoMedicalAdvice'
    | 'NoTables'
    | 'NoFAQ'
    | 'NoExternalLinks'
    | 'Custom';
  value?: string;
  reason: string;
  severity: 'critical' | 'warning';
  scope: ConstraintScope;
  paragraphId?: string;
};

export type ParagraphGoal =
  | 'intro'
  | 'definition'
  | 'context'
  | 'problem'
  | 'symptoms'
  | 'benefits'
  | 'comparison'
  | 'warning'
  | 'example'
  | 'steps'
  | 'checklist'
  | 'faq'
  | 'summary'
  | 'cta';

export type ParagraphPlan = {
  id: string;
  sectionId: string;
  goal: ParagraphGoal;
  expectedWords: number;
  dependsOnParagraphs: string[];
  claims: ClaimRef[];
  facts: FactRef[];
  entities: EntityRef[];
  questions: QuestionRef[];
  keywords: TermUsage[];
  examples: ExampleRef[];
  sources: SourceRef[];
  transitionFrom?: string;
  transitionTo?: string;
  style: { list?: boolean; table?: boolean; boldTerms?: boolean };
  constraints: WriterConstraint[];
};

export type KnowledgePack = {
  id: string;
  sectionId: string;
  heading: string;
  objective: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  expectedWords: number;
  paragraphPlanIds: string[];
  sectionClaimIds: string[];
  sectionFactIds: string[];
  sectionEntityIds: string[];
  sectionQuestionIds: string[];
  sectionSourceIds: string[];
  sectionExampleIds: string[];
  sectionConstraints: WriterConstraint[];
  sectionTransitions: {
    fromPrevious: string | null;
    toNext: string | null;
  };
};

export type EditorialMemory = {
  summary: string;
  entities: string[];
  introducedConcepts: string[];
  avoidRepeating: string[];
};

/** Immutable Writer output — never mutated by Judge. */
export type ParagraphResult = {
  paragraphId: string;
  sectionId: string;
  markdown: string;
  summary: string;
  confidence: number; // 0-1 Writer self-assessment
  usedClaimIds: string[];
  usedFactIds: string[];
  usedEntityIds: string[];
  usedTerms: Array<{ term: string; count: number }>;
  coverage: {
    questionsAnswered: string[];
    questionsMissed: string[];
  };
};

/** Judge output — new object; original ParagraphResult retained for audit. */
export type ReviewedParagraphResult = {
  base: ParagraphResult; // reference / frozen copy of original
  markdown: string;
  summary: string;
  confidence: number;
  judgeNotes: string[];
  rewritten: boolean;
};

export type KnowledgeGraphSnapshot = {
  version: string; // semver or monotonic "1"
  createdAt: string; // ISO
  plannerVersion: string;
  researchVersion: string; // "none" until Acquisition
  sources: Source[];
  entities: Entity[];
  claims: Claim[];
  facts: Fact[];
  questions: Question[];
};

export type CompileDiagnosticLevel = 'warning' | 'info';

export type CompileDiagnostic = {
  level: CompileDiagnosticLevel;
  code: string;
  message: string;
  packId?: string;
  paragraphId?: string;
};

export type CompileMetrics = {
  paragraphCount: number;
  packCount: number;
  wordBudget: number;
  /** 0-100 rough: questions with >=1 paragraph assignment */
  coveragePct: number;
  /** 0-100 rough: entities referenced / entities in graph (100 if graph empty) */
  entityCoveragePct: number;
};

/** Warnings/infos/metrics from compile — independent of validation errors. */
export type CompileDiagnostics = {
  warnings: CompileDiagnostic[];
  infos: CompileDiagnostic[];
  metrics: CompileMetrics;
};

/** Compiled artifact — output of WritePlanCompiler, input to Runtime. */
export type CompiledWritePlan = {
  planHash: string;
  title: string;
  quickAnswer: string;
  keyword: string;
  knowledgePacks: KnowledgePack[];
  paragraphPlans: ParagraphPlan[];
  graph: KnowledgeGraphSnapshot;
  /** Filled in PR-B; PR-A may use placeholder manifest with compilerVersion only */
  manifest: PipelineManifest;
  diagnostics: CompileDiagnostics;
  coverageGaps?: Array<{
    text: string;
    importance: string;
    covered: boolean;
    paragraphId?: string;
  }>;
};

/** Minimal markdown AST — enough for h2/p/ul/ol/li/strong/em/a/table. */
export type MdNode =
  | { type: 'heading'; depth: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

export type MdAst = { children: MdNode[] };

export type ValidationStage = 'structural' | 'semantic' | 'runtime';

export type PackValidationIssue = {
  stage: ValidationStage;
  code: string;
  message: string;
  packId?: string;
  paragraphId?: string;
};

export type PackValidationResult = {
  ok: boolean;
  issues: PackValidationIssue[];
};

/** PR-A: structural only. PR-B: full pipeline. */
export type CompileResult =
  | { ok: true; plan: CompiledWritePlan; diagnostics: CompileDiagnostics }
  | { ok: false; issues: PackValidationIssue[]; diagnostics: CompileDiagnostics };

/**
 * Override execution-plan section headings with user-approved outline (TipTap Hn).
 * Also: build a minimal execution plan when Plan Validator blocked write but the
 * user already approved headings (outline-review path).
 */
import type {
  ArticleBlueprint,
  ArticleBudget,
  ArticleExecutionPlan,
  CompetitorBenchmark,
  ContentPlannerBundle,
  ExecutionPlanSection,
  IntentBlueprint,
  KnowledgeCoverageReport,
  ReaderModel,
} from './types';
import { BENCHMARK_H2_FLOOR, BENCHMARK_WORDS_FLOOR, PLANNER_VERSION } from './types';
import { hashExecutionPlanPayload } from './executionPlan';

export type ApprovedOutlineHeading = {
  level: number;
  text: string;
};

/** Bundle fields salvageable when canWrite is false (blueprint may still exist). */
export type ApprovedOutlinePlanBundle = Pick<
  ContentPlannerBundle,
  'intent' | 'reader' | 'benchmark' | 'blueprint' | 'builtAt'
>;

const DEFAULT_BUDGET = {
  words: 300,
  claims: 0,
  entities: 1,
  questions: 0,
  examples: 0,
  lists: 0,
  tables: 0,
  images: 0,
  faq: 0,
  citations: 0,
} as const;

const EMPTY_COVERAGE: KnowledgeCoverageReport = {
  criticalClaims: { total: 0, assigned: 0, pct: 100 },
  questions: { total: 0, assigned: 0, pct: 100 },
  evidenceNeeds: { total: 0, assigned: 0, pct: 100 },
  knowledgeCoveragePct: 100,
};

function normalizeHeadings(approved: ApprovedOutlineHeading[]): ApprovedOutlineHeading[] {
  return approved
    .map((h) => ({
      level: Math.min(Math.max(Number(h.level) || 2, 1), 4),
      text: String(h.text || '').trim(),
    }))
    .filter((h) => h.text.length > 0);
}

function stubSection(i: number, template: ExecutionPlanSection | undefined): ExecutionPlanSection {
  return {
    id: `approved-${i}`,
    heading: '',
    objective: 'Cover this section thoroughly',
    priority: 'high',
    expectedWords: template?.expectedWords ?? 300,
    claims: [],
    entities: template?.entities?.slice(0, 2) ?? [],
    questions: [],
    mustAnswer: [],
    evidence: [],
    blocks: template?.blocks?.length ? [...template.blocks] : ['summary'],
    budget: template?.budget ? { ...template.budget } : { ...DEFAULT_BUDGET },
    writerHints: template?.writerHints
      ? { ...template.writerHints }
      : {
          previousSection: null,
          nextSection: null,
          transition: '',
          tone: 'practical',
          avoidRepeating: [],
        },
    reason: { summary: 'User-approved outline heading', signals: [] },
  };
}

/** Rebuild plan sections from approved Hn; keep planner briefs by index when present. */
export function applyApprovedOutlineToPlan(
  plan: ArticleExecutionPlan,
  approved: ApprovedOutlineHeading[],
): ArticleExecutionPlan {
  const headings = normalizeHeadings(approved);
  if (!headings.length) return plan;

  const body = headings.filter((h) => h.level >= 2);
  const use = body.length > 0 ? body : headings;
  const template = plan.sections[0];

  const sections: ExecutionPlanSection[] = use.map((h, i) => {
    const base = plan.sections[i] ?? stubSection(i, template);
    return {
      ...base,
      id: base.id || `approved-${i}`,
      heading: h.text,
      objective: base.objective || `Write section: ${h.text}`,
      reason: {
        summary: `User-approved outline: ${h.text}`,
        signals: base.reason?.signals ?? [],
      },
    };
  });

  const h1 = headings.find((h) => h.level === 1);
  const { planHash: _drop, ...rest } = plan;
  const payload: Omit<ArticleExecutionPlan, 'planHash'> = {
    ...rest,
    title: h1?.text || plan.title,
    sections,
  };
  return { ...payload, planHash: hashExecutionPlanPayload(payload) };
}

function defaultBenchmark(h2Count: number): CompetitorBenchmark {
  const targetH2 = Math.max(BENCHMARK_H2_FLOOR, h2Count);
  return {
    averageWords: BENCHMARK_WORDS_FLOOR,
    bestWords: BENCHMARK_WORDS_FLOOR,
    averageH2: targetH2,
    averageParagraphs: 20,
    averageLists: 2,
    averageTables: 0,
    averageImages: 0,
    averageFaq: 0,
    averageClaims: 5,
    averageExamples: 2,
    averageQuestions: 4,
    targetWords: BENCHMARK_WORDS_FLOOR,
    targetH2,
  };
}

function defaultBudget(words: number, h2: number): ArticleBudget {
  return {
    words,
    paragraphs: Math.max(12, Math.round(words / 100)),
    h2,
    lists: 2,
    tables: 0,
    images: 0,
    claims: Math.max(5, h2),
    questions: Math.max(4, Math.ceil(h2 / 2)),
    examples: 2,
    warnings: 0,
    checklists: 0,
    comparisons: 0,
    faq: 0,
  };
}

/**
 * Minimal ArticleExecutionPlan from user-approved TipTap headings.
 * Used when Plan Validator / CIE floor blocks canWrite but the user already
 * reviewed the outline and asked to generate.
 */
export function buildExecutionPlanFromApprovedOutline(opts: {
  keyword: string;
  headings: ApprovedOutlineHeading[];
  bundle?: ApprovedOutlinePlanBundle | null;
}): ArticleExecutionPlan | null {
  const headings = normalizeHeadings(opts.headings);
  const body = headings.filter((h) => h.level >= 2);
  if (!body.length) return null;

  const keyword = (opts.keyword || opts.bundle?.intent?.keyword || '').trim() || 'article';
  const h1 = headings.find((h) => h.level === 1);
  const title = h1?.text || keyword;
  const wordsPerSection = 280;
  const targetWords = Math.max(
    opts.bundle?.blueprint?.targetWords ?? opts.bundle?.benchmark?.targetWords ?? BENCHMARK_WORDS_FLOOR,
    body.length * wordsPerSection,
  );
  const benchmark = opts.bundle?.benchmark ?? defaultBenchmark(body.length);
  const blueprint: ArticleBlueprint | undefined = opts.bundle?.blueprint;
  const articleBudget = blueprint?.budget
    ?? defaultBudget(targetWords, Math.max(benchmark.targetH2, body.length));

  const intent: IntentBlueprint | undefined = opts.bundle?.intent;
  const reader: ReaderModel | undefined = opts.bundle?.reader;

  const sections: ExecutionPlanSection[] = body.map((h, i) => {
    const sec = stubSection(i, undefined);
    return {
      ...sec,
      heading: h.text,
      objective: `Write section: ${h.text}`,
      expectedWords: wordsPerSection,
      budget: { ...sec.budget, words: wordsPerSection },
      reason: { summary: `User-approved outline: ${h.text}`, signals: [] },
    };
  });

  const withoutHash: Omit<ArticleExecutionPlan, 'planHash'> = {
    schemaVersion: 2,
    plannerVersion: PLANNER_VERSION,
    keyword,
    title,
    narrative: intent?.narrativePreference ?? 'problem_solution',
    quickAnswer: `${title}.`,
    reader: {
      persona: reader?.readerPersona || 'reader',
      goal: reader?.goal || 'understand the topic',
      tone: reader?.tone || 'practical',
      timeBudgetMinutes: reader?.timeBudgetMinutes ?? 8,
    },
    articleBudget,
    benchmark: {
      ...benchmark,
      targetWords: Math.max(benchmark.targetWords, targetWords),
      targetH2: Math.max(benchmark.targetH2, body.length),
    },
    knowledgeCoverage: EMPTY_COVERAGE,
    requiredCoverage: {
      claims: Math.max(blueprint?.targetClaims ?? 0, 0),
      questions: Math.max(blueprint?.targetQuestions ?? 0, 0),
      entities: 1,
      evidence: 0,
      examples: Math.max(blueprint?.targetExamples ?? 0, 0),
    },
    sections,
    builtAt: opts.bundle?.builtAt || new Date().toISOString(),
  };

  return { ...withoutHash, planHash: hashExecutionPlanPayload(withoutHash) };
}

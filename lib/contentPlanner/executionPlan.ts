/**
 * Article Execution Plan — immutable Write Engine contract + sidecar projection.
 */
import { createHash } from 'crypto';
import type {
  ArticleExecutionPlan,
  ContentPlannerBundle,
  ExecutionPlanSection,
} from './types';
import { PLANNER_VERSION } from './types';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function hashExecutionPlanPayload(payload: Omit<ArticleExecutionPlan, 'planHash'>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 32);
}

export function buildArticleExecutionPlan(
  bundle: ContentPlannerBundle,
): ArticleExecutionPlan | null {
  if (!bundle.outline || !bundle.briefs.length || !bundle.quickAnswer?.trim()) {
    return null;
  }
  if (!bundle.knowledgeCoverage) return null;

  const claimMap = new Map(bundle.targetKg.claims.map((c) => [c.id, c]));
  const questionMap = new Map(bundle.targetKg.questions.map((q) => [q.id, q]));

  const sections: ExecutionPlanSection[] = bundle.briefs.map((b) => {
    const claims = b.claimIds
      .slice(0, 8)
      .map((id) => claimMap.get(id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map((c) => ({ id: c.id, statement: c.statement, sources: c.sources }));
    const questions = b.questionIds
      .map((id) => questionMap.get(id)?.question)
      .filter((q): q is string => Boolean(q));
    const entities = bundle.targetKg.entities.slice(0, Math.max(2, b.budget.entities));
    return {
      id: b.sectionId,
      heading: b.heading,
      objective: b.objective,
      priority: b.sectionPriority,
      expectedWords: b.budget.words,
      claims,
      entities,
      questions,
      mustAnswer: b.mustAnswer,
      evidence: b.evidence,
      blocks: b.blocks,
      budget: b.budget,
      writerHints: b.writerHints,
      reason: b.reason || {
        summary: `Sekcja „${b.heading}” z ${claims.length} claims`,
        signals: claims.slice(0, 3).map((c) => c.id),
      },
    };
  });

  const withoutHash: Omit<ArticleExecutionPlan, 'planHash'> = {
    schemaVersion: 2,
    plannerVersion: PLANNER_VERSION,
    keyword: bundle.keyword,
    title: bundle.outline.h1,
    narrative: bundle.intent.narrativePreference,
    quickAnswer: bundle.quickAnswer.trim(),
    reader: {
      persona: bundle.reader.readerPersona,
      goal: bundle.reader.goal,
      tone: bundle.reader.tone,
      timeBudgetMinutes: bundle.reader.timeBudgetMinutes,
    },
    articleBudget: bundle.blueprint.budget,
    benchmark: bundle.benchmark,
    knowledgeCoverage: bundle.knowledgeCoverage,
    requiredCoverage: {
      claims: bundle.blueprint.targetClaims,
      questions: bundle.blueprint.targetQuestions,
      entities: Math.max(bundle.targetKg.entities.length, 5),
      evidence: sections.reduce((n, s) => n + s.evidence.length, 0),
      examples: bundle.blueprint.targetExamples,
    },
    sections,
    builtAt: bundle.builtAt,
  };

  return {
    ...withoutHash,
    planHash: hashExecutionPlanPayload(withoutHash),
  };
}

/** Snake_case JSON for Python Write Engine (executor only). */
export function toSidecarExecutionPlan(plan: ArticleExecutionPlan): Record<string, unknown> {
  return {
    schema_version: plan.schemaVersion,
    planner_version: plan.plannerVersion,
    plan_hash: plan.planHash,
    keyword: plan.keyword,
    title: plan.title,
    narrative: plan.narrative,
    quick_answer: plan.quickAnswer,
    reader: {
      persona: plan.reader.persona,
      goal: plan.reader.goal,
      tone: plan.reader.tone,
      time_budget_minutes: plan.reader.timeBudgetMinutes,
    },
    article_budget: {
      words: plan.articleBudget.words,
      paragraphs: plan.articleBudget.paragraphs,
      h2: plan.articleBudget.h2,
      claims: plan.articleBudget.claims,
      questions: plan.articleBudget.questions,
      examples: plan.articleBudget.examples,
      faq: plan.articleBudget.faq,
      images: plan.articleBudget.images,
    },
    benchmark: {
      target_words: plan.benchmark.targetWords,
      target_h2: plan.benchmark.targetH2,
    },
    knowledge_coverage_pct: plan.knowledgeCoverage.knowledgeCoveragePct,
    sections: plan.sections.map((s) => ({
      id: s.id,
      heading: s.heading,
      objective: s.objective,
      priority: s.priority,
      expected_words: s.expectedWords,
      claims: s.claims.map((c) => ({
        id: c.id,
        statement: c.statement,
        sources: c.sources.map((src) => ({
          url: src.url,
          label: src.label,
          confidence: src.confidence,
        })),
      })),
      entities: s.entities,
      questions: s.questions,
      must_answer: s.mustAnswer,
      evidence: s.evidence,
      blocks: s.blocks,
      budget: s.budget,
      reason: s.reason || null,
    })),
  };
}

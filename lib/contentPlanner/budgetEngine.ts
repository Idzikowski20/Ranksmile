/**
 * Budget Engine + Article Blueprint from Competitor Benchmark + Target KG.
 */
import { h2FromWords } from './competitorBenchmark';
import type {
  ArticleBlueprint,
  ArticleBudget,
  CompetitorBenchmark,
  FreshnessTier,
  IntentBlueprint,
  ReaderModel,
  TargetKnowledgeGraph,
} from './types';

export function buildArticleBudget(
  benchmark: CompetitorBenchmark,
  kg: TargetKnowledgeGraph,
): ArticleBudget {
  const words = benchmark.targetWords;
  const h2 = Math.max(benchmark.targetH2, h2FromWords(words));
  const requiredClaims = kg.claims.filter((c) => c.importance === 'required').length;
  const requiredQuestions = kg.questions.filter((q) => q.importance === 'required').length;
  const kgClaimCap = Math.max(kg.claims.length, requiredClaims, 1);
  const kgQuestionCap = Math.max(kg.questions.length, requiredQuestions, 1);
  // Never demand more assignable claims/questions than Target KG holds.
  const claims = Math.min(
    kgClaimCap,
    Math.max(requiredClaims, Math.round(benchmark.averageClaims || kgClaimCap), Math.min(kgClaimCap, h2)),
  );
  const questions = Math.min(
    kgQuestionCap,
    Math.max(requiredQuestions, Math.round(benchmark.averageQuestions || kgQuestionCap), Math.min(kgQuestionCap, 8)),
  );
  return {
    words,
    paragraphs: Math.max(benchmark.averageParagraphs, Math.round(words / 40)),
    h2,
    lists: Math.max(benchmark.averageLists, Math.round(h2 * 1.2)),
    tables: Math.max(benchmark.averageTables, 1),
    images: Math.max(benchmark.averageImages, 2),
    claims,
    questions,
    examples: Math.max(1, Math.min(Math.round(benchmark.averageExamples || h2 * 0.5), h2)),
    warnings: Math.max(2, Math.round(h2 * 0.25)),
    checklists: Math.max(2, Math.round(h2 * 0.25)),
    comparisons: Math.max(1, Math.round(h2 * 0.1)),
    faq: Math.max(benchmark.averageFaq, Math.min(kgQuestionCap, 5)),
  };
}

export function inferFreshness(intent: IntentBlueprint, keyword: string): FreshnessTier {
  const blob = `${keyword} ${intent.yearHint}`;
  if (/\b(202\d|ai overview|core web vitals|algorytm|update)\b/i.test(blob)) return 'high';
  if (intent.articleType === 'step-by-step') return 'medium';
  return 'low';
}

export function buildArticleBlueprint(opts: {
  benchmark: CompetitorBenchmark;
  kg: TargetKnowledgeGraph;
  intent: IntentBlueprint;
  reader: ReaderModel;
}): ArticleBlueprint {
  const budget = buildArticleBudget(opts.benchmark, opts.kg);
  const requiredSections = baseRequiredSections(opts.reader);
  return {
    targetWords: budget.words,
    targetH2: budget.h2,
    targetParagraphs: budget.paragraphs,
    targetLists: budget.lists,
    targetTables: budget.tables,
    targetImages: budget.images,
    targetFaqs: budget.faq,
    targetClaims: budget.claims,
    targetQuestions: budget.questions,
    targetExamples: budget.examples,
    targetChecklists: budget.checklists,
    requiredSections,
    freshness: inferFreshness(opts.intent, opts.reader.keyword),
    budget,
  };
}

function baseRequiredSections(reader: ReaderModel): string[] {
  // Step-by-step / beginner: action path, not encyclopedia course outline.
  if (reader.articleType === 'step-by-step' || reader.readerPersona === 'beginner') {
    const steps = [
      'Quick Answer',
      'Quick Wins',
      'Step-by-step plan',
      'Keywords and intent',
      'Technical foundation',
      'Content that ranks',
      'Measurement',
      'Common Mistakes',
      'FAQ',
      'Summary',
    ];
    if (reader.fears.some((f) => /koszt|cena|cost/i.test(f))) {
      steps.splice(7, 0, 'Cost');
    }
    return steps;
  }
  const base = ['Quick Start', 'Foundation', 'Checklist', 'Common Mistakes', 'FAQ', 'Summary'];
  if (reader.fears.some((f) => /koszt|cena|cost/i.test(f))) {
    base.splice(4, 0, 'Cost');
  }
  if (reader.readerPersona === 'beginner') {
    base.unshift('Quick Answer');
  }
  return [...new Set(base)];
}

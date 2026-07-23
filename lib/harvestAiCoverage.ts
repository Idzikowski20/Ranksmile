import { scoreCitationPrompt } from './citationPrompts';
import { scorePaaQuestion } from './curateCoverageItems';
import type { LlmCoverageSource } from './llmCoverageQuestions';
import type { MissingItem, StageResult } from './primitives/types';
import {
  dedupeWithProvenance,
  type HarvestedQuestion,
} from './harvest/canonicalizeQuestion';
import { clusterQuestions } from './harvest/clusterQuestions';
import {
  enforceBudget,
  medianQuestionCount,
  type BudgetedTopic,
} from './harvest/enforceBudget';
import { fillMissingTopics } from './harvest/fillMissingTopics';
import { checkKeywordArticleIntent } from './harvest/keywordArticleIntentGate';
import {
  fetchAllProviders,
  type CoverageProvider,
  type ProviderContext,
  type ProviderResult,
} from './harvest/providers';

export type { HarvestedQuestion };
export type { BudgetedTopic };
export type HarvestTopic = BudgetedTopic & {
  origin?: 'outline' | 'llm' | 'merged';
  score?: number;
  confidence?: number;
};

export type HarvestStats = {
  rawQuestions: number;
  uniqueQuestions: number;
  deduped: number;
  topicsBeforeBudget: number;
  topicsAfterBudget: number;
  bySource: Record<string, number>;
  llmAddedTopics: number;
  budgetRemovedQuestions: number;
  medianQuestionsPerTopic: number;
  lowConfidenceAssignments: number;
  providerLatency: Record<string, number>;
  coverageEntropy?: number;
  intentGateOnTopic?: boolean;
  intentGateSense?: string;
  schemaVersion: number;
  pipelineVersion: number;
  scoringVersion: number;
};

export type HarvestResult = {
  topics: HarvestTopic[];
  questions: HarvestedQuestion[];
  stats: HarvestStats;
  llmQuestions: Array<{ question: string; sources: LlmCoverageSource[] }>;
  stages: StageResult[];
  missing: MissingItem[];
  intentGate?: ReturnType<typeof checkKeywordArticleIntent>;
};

function qualityFor(question: string, keyword: string): number {
  return scoreCitationPrompt(question, keyword) || scorePaaQuestion(question, keyword) || 0;
}

function mergeProviderRows(
  results: ProviderResult[],
  keyword: string,
): Array<{ question: string; sources: LlmCoverageSource[]; quality: number; weightHint?: number; provider?: string }> {
  const rows: Array<{
    question: string;
    sources: LlmCoverageSource[];
    quality: number;
    weightHint?: number;
    provider?: string;
  }> = [];
  for (const res of results) {
    for (const q of res.questions) {
      rows.push({
        question: q.question,
        sources: q.sources,
        quality: qualityFor(q.question, keyword),
        weightHint: res.weightHint,
        provider: res.provider,
      });
    }
  }
  return rows;
}

function buildBySource(questions: HarvestedQuestion[]): Record<string, number> {
  const bySource: Record<string, number> = {};
  for (const q of questions) {
    for (const s of q.sources) {
      bySource[s] = (bySource[s] || 0) + 1;
    }
  }
  return bySource;
}

/** Shannon-ish entropy of question counts across topics (detects 12+1+1 clusters). */
function coverageEntropy(topics: Array<{ questions: unknown[] }>): number {
  const counts = topics.map((t) => t.questions.length).filter((n) => n > 0);
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0 || counts.length <= 1) return 0;
  let h = 0;
  for (const c of counts) {
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return Math.round(h * 1000) / 1000;
}

function parseOutlineTitles(cache: string | null | undefined): string[] {
  if (!cache) return [];
  try {
    const parsed = JSON.parse(cache) as unknown;
    const list = Array.isArray(parsed)
      ? parsed
      : (parsed && typeof parsed === 'object' && Array.isArray((parsed as { competitors?: unknown }).competitors)
        ? (parsed as { competitors: unknown[] }).competitors
        : []);
    const topics: string[] = [];
    for (const c of list) {
      if (!c || typeof c !== 'object') continue;
      const headings = (c as { headings?: unknown }).headings;
      if (!Array.isArray(headings)) continue;
      for (const h of headings) {
        if (!h || typeof h !== 'object') continue;
        const level = (h as { level?: unknown }).level;
        const text = (h as { text?: unknown }).text;
        if ((level === 2 || level === 3) && typeof text === 'string') {
          const t = text.trim();
          if (t.length >= 8 && t.length <= 80) topics.push(t);
        }
      }
    }
    const seen = new Set<string>();
    return topics.filter((t) => {
      const k = t.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 12);
  } catch {
    return [];
  }
}

export type HarvestOpts = ProviderContext & {
  outlineTitles?: string[];
  competitorOutlinesCache?: string | null;
  providers?: CoverageProvider[];
  skipFill?: boolean;
  articleTitle?: string;
  articleExcerpt?: string;
};

function emptyHarvest(extra?: Partial<HarvestResult>): HarvestResult {
  return {
    topics: [],
    questions: [],
    llmQuestions: [],
    stages: [],
    missing: [],
    stats: {
      rawQuestions: 0,
      uniqueQuestions: 0,
      deduped: 0,
      topicsBeforeBudget: 0,
      topicsAfterBudget: 0,
      bySource: {},
      llmAddedTopics: 0,
      budgetRemovedQuestions: 0,
      medianQuestionsPerTopic: 0,
      lowConfidenceAssignments: 0,
      providerLatency: {},
      schemaVersion: 2,
      pipelineVersion: 4,
      scoringVersion: 3,
    },
    ...extra,
  };
}

async function stage<TIn, TOut>(
  name: string,
  version: number,
  input: TIn,
  run: () => Promise<TOut> | TOut,
  statsOf?: (out: TOut) => Record<string, number | string>,
): Promise<{ out: TOut; stage: StageResult<TIn, TOut> }> {
  const t0 = Date.now();
  const out = await run();
  return {
    out,
    stage: {
      name,
      input,
      output: out,
      stats: statsOf ? statsOf(out) : {},
      durationMs: Date.now() - t0,
      version,
    },
  };
}

/**
 * Harvest AI Search coverage questions into semantic topics.
 * Staged: intent → collect → normalize/dedupe → cluster → fill → budget → persist stats.
 */
export async function harvestAiCoverage(opts: HarvestOpts): Promise<HarvestResult> {
  const keyword = opts.keyword.trim();
  if (!keyword) {
    return emptyHarvest();
  }

  const stages: StageResult[] = [];
  const outlineTitles = opts.outlineTitles?.length
    ? opts.outlineTitles
    : parseOutlineTitles(opts.competitorOutlinesCache);

  const intentGate = checkKeywordArticleIntent({
    keyword,
    articleTitle: opts.articleTitle,
    articleExcerpt: opts.articleExcerpt,
    outlineTitles,
  });
  stages.push({
    name: 'intent_gate',
    input: { keyword },
    output: intentGate,
    stats: { onTopic: intentGate.onTopic ? 1 : 0, confidence: intentGate.confidence },
    durationMs: 0,
    version: 1,
  });

  // Off-angle: skip LLM-heavy fill; still allow PAA/provider collect but mark missing intent.
  const missing: MissingItem[] = [];
  if (!intentGate.onTopic) {
    missing.push({
      id: 'intent-mismatch',
      type: 'intent',
      reason: intentGate.reason || 'Keyword may not match article angle',
      severity: 'high',
      confidence: intentGate.confidence,
    });
  }

  const collectStage = await stage('collect', 4, { keyword }, () =>
    fetchAllProviders(
      {
        keyword,
        country: opts.country,
        languageCode: opts.languageCode,
        paaQuestions: opts.paaQuestions,
      },
      opts.providers,
    ), (results) => ({ providers: results.length, questions: results.reduce((n, r) => n + r.questions.length, 0) }));
  stages.push(collectStage.stage);
  const providerResults = collectStage.out;

  const providerLatency: Record<string, number> = {};
  for (const r of providerResults) {
    providerLatency[r.provider] = r.latencyMs;
  }

  const rawRows = mergeProviderRows(providerResults, keyword);
  const rawQuestions = rawRows.length;

  const dedupeStage = await stage('dedupe', 3, { rawQuestions }, () => dedupeWithProvenance(rawRows), (qs) => ({
    unique: qs.length,
    deduped: Math.max(0, rawQuestions - qs.length),
  }));
  stages.push(dedupeStage.stage);
  const questions = dedupeStage.out;
  const uniqueQuestions = questions.length;
  const deduped = Math.max(0, rawQuestions - uniqueQuestions);

  const clusterStage = await stage(
    'cluster',
    2,
    { outlineCount: outlineTitles.length },
    () => clusterQuestions(outlineTitles, questions),
    (c) => ({ topics: c.topics.length, lowConf: c.lowConfidenceAssignments }),
  );
  stages.push(clusterStage.stage);
  let topics = clusterStage.out.topics;
  let llmAddedTopics = 0;

  const skipFill = opts.skipFill || !intentGate.onTopic;
  if (!skipFill) {
    const fillStage = await stage('fill', 2, { topics: topics.length }, () =>
      fillMissingTopics({
        keyword,
        languageCode: opts.languageCode,
        topics,
        uniqueQuestions,
      }), (f) => ({ llmAdded: f.llmAddedTopics }));
    stages.push(fillStage.stage);
    topics = fillStage.out.topics;
    llmAddedTopics = fillStage.out.llmAddedTopics;
  }

  const topicsBeforeBudget = topics.length;
  const budgetStage = await stage('budget', 2, { topics: topicsBeforeBudget }, () => enforceBudget(topics), (b) => ({
    topics: b.topics.length,
    removed: b.budgetRemovedQuestions,
  }));
  stages.push(budgetStage.stage);
  const budgeted = budgetStage.out;
  const median = medianQuestionCount(budgeted.topics);

  const enrichedTopics: HarvestTopic[] = budgeted.topics.map((t) => {
    const score = t.questions.reduce((s, q) => s + q.questionScore, 0);
    const origin: HarvestTopic['origin'] = outlineTitles.some((o) => o === t.title)
      ? (llmAddedTopics > 0 ? 'merged' : 'outline')
      : 'llm';
    const avgConf =
      t.questions.length > 0
        ? t.questions.reduce((s, q) => s + (q.confidence ?? 0.7), 0) / t.questions.length
        : 0.5;
    return { ...t, origin, score, confidence: avgConf };
  });

  const flat = enrichedTopics.flatMap((t) =>
    t.questions.map((q) => ({ ...q, topicId: t.id })),
  );
  const llmQuestions = flat.map((q) => ({
    question: q.question,
    sources: q.sources,
  }));

  return {
    topics: enrichedTopics,
    questions: flat,
    llmQuestions,
    stages,
    missing,
    intentGate,
    stats: {
      rawQuestions,
      uniqueQuestions,
      deduped,
      topicsBeforeBudget,
      topicsAfterBudget: enrichedTopics.length,
      bySource: buildBySource(questions),
      llmAddedTopics,
      budgetRemovedQuestions: budgeted.budgetRemovedQuestions,
      medianQuestionsPerTopic: median,
      lowConfidenceAssignments: clusterStage.out.lowConfidenceAssignments,
      providerLatency,
      coverageEntropy: coverageEntropy(enrichedTopics),
      intentGateOnTopic: intentGate.onTopic,
      intentGateSense: intentGate.sense,
      schemaVersion: 2,
      pipelineVersion: 4,
      scoringVersion: 3,
    },
  };
}

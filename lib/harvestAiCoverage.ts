import { scoreCitationPrompt } from './citationPrompts';
import { scorePaaQuestion } from './curateCoverageItems';
import type { LlmCoverageSource } from './llmCoverageQuestions';
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
import {
  fetchAllProviders,
  type CoverageProvider,
  type ProviderContext,
  type ProviderResult,
} from './harvest/providers';

export type { HarvestedQuestion };
export type { BudgetedTopic };
export type HarvestTopic = BudgetedTopic;

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
};

export type HarvestResult = {
  topics: HarvestTopic[];
  questions: HarvestedQuestion[];
  stats: HarvestStats;
  /** Flat list for curateAiCoverageItems / buildGradedCoverageSnapshot */
  llmQuestions: Array<{ question: string; sources: LlmCoverageSource[] }>;
};

function qualityFor(question: string, keyword: string): number {
  return scoreCitationPrompt(question, keyword) || scorePaaQuestion(question, keyword) || 0;
}

function mergeProviderRows(
  results: ProviderResult[],
  keyword: string,
): Array<{ question: string; sources: LlmCoverageSource[]; quality: number; weightHint?: number }> {
  const rows: Array<{ question: string; sources: LlmCoverageSource[]; quality: number; weightHint?: number }> = [];
  for (const res of results) {
    for (const q of res.questions) {
      rows.push({
        question: q.question,
        sources: q.sources,
        quality: qualityFor(q.question, keyword),
        weightHint: res.weightHint,
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
  /** Skip LLM fill (tests). */
  skipFill?: boolean;
};

function emptyHarvest(): HarvestResult {
  return {
    topics: [],
    questions: [],
    llmQuestions: [],
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
    },
  };
}

/**
 * Harvest AI Search coverage questions into semantic topics.
 * Thin orchestrator: providers → merge → canonicalize/dedupe → cluster → fill → budget → stats.
 */
export async function harvestAiCoverage(opts: HarvestOpts): Promise<HarvestResult> {
  const keyword = opts.keyword.trim();
  if (!keyword) {
    return emptyHarvest();
  }

  const providerResults = await fetchAllProviders(
    {
      keyword,
      country: opts.country,
      languageCode: opts.languageCode,
      paaQuestions: opts.paaQuestions,
    },
    opts.providers,
  );

  const providerLatency: Record<string, number> = {};
  for (const r of providerResults) {
    providerLatency[r.provider] = r.latencyMs;
  }

  const rawRows = mergeProviderRows(providerResults, keyword);
  const rawQuestions = rawRows.length;
  const questions = dedupeWithProvenance(rawRows);
  const uniqueQuestions = questions.length;
  const deduped = Math.max(0, rawQuestions - uniqueQuestions);

  const outlineTitles = opts.outlineTitles?.length
    ? opts.outlineTitles
    : parseOutlineTitles(opts.competitorOutlinesCache);

  const clustered = clusterQuestions(outlineTitles, questions);
  let topics = clustered.topics;
  let llmAddedTopics = 0;

  if (!opts.skipFill) {
    const filled = await fillMissingTopics({
      keyword,
      languageCode: opts.languageCode,
      topics,
      uniqueQuestions,
    });
    topics = filled.topics;
    llmAddedTopics = filled.llmAddedTopics;
  }

  const topicsBeforeBudget = topics.length;
  const budgeted = enforceBudget(topics);
  const median = medianQuestionCount(budgeted.topics);

  const flat = budgeted.topics.flatMap((t) => t.questions);
  const llmQuestions = flat.map((q) => ({
    question: q.question,
    sources: q.sources,
  }));

  return {
    topics: budgeted.topics,
    questions: flat,
    llmQuestions,
    stats: {
      rawQuestions,
      uniqueQuestions,
      deduped,
      topicsBeforeBudget,
      topicsAfterBudget: budgeted.topics.length,
      bySource: buildBySource(questions),
      llmAddedTopics,
      budgetRemovedQuestions: budgeted.budgetRemovedQuestions,
      medianQuestionsPerTopic: median,
      lowConfidenceAssignments: clustered.lowConfidenceAssignments,
      providerLatency,
    },
  };
}

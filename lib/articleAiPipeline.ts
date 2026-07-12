/**
 * Shared AI Search pipeline for deep-analysis and manual ai-visibility runs.
 * Facts from DataForSEO PAA answers, visibility from PAA questions + sidecar.
 */
import {
  fetchArticleFacts,
  factsToVisibilitySummary,
  mergeVisibilitySummaries,
  type ArticleFact,
} from './articleFacts';
import { resolveFactKeyword } from './resolveFactKeyword';
import { getAiSearchInfo } from './seo/keywordData';
import {
  computeAiSearchScoreV2,
  type AiVisibilitySummary,
} from './aiSearchScore';

export type ArticleAiPipelineResult = {
  facts: ArticleFact[];
  summary: AiVisibilitySummary | null;
  aiScore: number;
};

export async function runArticleAiPipeline(opts: {
  keyword: string;
  articleText: string;
  corpusTexts?: string[];
  title?: string;
  pageUrl?: string;
  country?: string;
  languageCode?: string;
  ownDomain?: string;
  sidecarSummary?: AiVisibilitySummary | null;
  intentScore?: number;
  answersMainQuestionEarly?: boolean;
  /** When set, skip resolveFactKeyword in fetchArticleFacts. */
  resolvedKeyword?: string;
}): Promise<ArticleAiPipelineResult> {
  const articleText = opts.articleText || '';
  const keyword = opts.resolvedKeyword ?? resolveFactKeyword({
    keyword: opts.keyword,
    articleText,
    title: opts.title,
    pageUrl: opts.pageUrl,
  });

  let facts: ArticleFact[] = [];
  if (keyword) {
    facts = await fetchArticleFacts({
      keyword,
      resolvedKeyword: keyword,
      corpusTexts: opts.corpusTexts,
      articleText,
      title: opts.title,
      pageUrl: opts.pageUrl,
      country: opts.country,
    });
  }

  let summary: AiVisibilitySummary | null = null;
  if (facts.length) {
    summary = factsToVisibilitySummary(facts, articleText);
  }

  const paaSummary = keyword
    ? await getAiSearchInfo({
      keyword,
      articleText,
      ownDomain: opts.ownDomain,
      country: opts.country,
      languageCode: opts.languageCode,
    }).catch(() => null)
    : null;

  if (summary && paaSummary) {
    summary = mergeVisibilitySummaries(summary, paaSummary);
  } else if (!summary) {
    summary = paaSummary;
  }

  if (opts.sidecarSummary?.citations?.length) {
    summary = summary
      ? mergeVisibilitySummaries(summary, opts.sidecarSummary)
      : opts.sidecarSummary;
  }

  const aiScore = facts.length
    ? computeAiSearchScoreV2({
      facts,
      articleText,
      intentScore: opts.intentScore,
      answersMainQuestionEarly: opts.answersMainQuestionEarly,
    })
    : 0;

  return { facts, summary, aiScore };
}

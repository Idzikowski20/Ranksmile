import { computeContentScore, countOccurrences, type ScoreData } from './contentScore';
import { liveCoverageItems, remainingOpportunities } from './liveCoverage';
import { computeCoverageScores, type BucketScore, type CoverageItem, type CoverageSnapshot } from './aiCoverage';
import { computeOverallContentScore, resolveAiScore, type AiVisibilitySummary } from './aiSearchScore';
import { paragraphCountFromHtml, scoreArticleHtml } from './scoreArticleHtml';

export interface LiveArticleScoresInput {
  plainText: string;
  wordCount: number;
  headingCount: number;
  html: string;
  scoreData: ScoreData | null;
  keyword: string;
  keywordCoverage?: Array<{ keyword: string; is_covered: boolean }>;
  coverageItems: CoverageItem[];
  coverageSnapshot: CoverageSnapshot | null;
  aiVisibilitySummary: AiVisibilitySummary | null;
  internalLinksCount: number;
  htmlForScoring?: string;
  fallbackScore?: number | null;
}

export interface LiveArticleScores {
  seo: number;
  ai: number;
  overall: number;
  hasAi: boolean;
}

export { paragraphCountFromHtml } from './scoreArticleHtml';

export interface OptimizeLiveSnapshot {
  postHtml: string;
  postText: string;
  seo: number;
  ai: number;
  overall: number;
  liveItems: CoverageItem[];
  buckets: BucketScore[];
  remainingRows: Array<{ label: string; count: number }>;
}

/** Single synchronous pass for Auto-Optimize — keeps SEO, AI, and overall in sync. */
export function computeOptimizeLiveSnapshot(opts: {
  editorHtml: string;
  scoreData: ScoreData;
  keyword: string;
  coverageItems: CoverageItem[];
  coverageSnapshot: CoverageSnapshot | null;
  substitutePlaceholders: (html: string) => string;
}): OptimizeLiveSnapshot {
  const postHtml = opts.substitutePlaceholders(opts.editorHtml);
  const scored = scoreArticleHtml({
    html: postHtml,
    scoreData: opts.scoreData,
    keyword: opts.keyword,
    coverageItems: opts.coverageItems,
    answersMainQuestionEarly: opts.coverageSnapshot?.answersMainQuestionEarly,
  });
  const { buckets } = computeCoverageScores(
    scored.liveItems,
    !!opts.coverageSnapshot?.answersMainQuestionEarly,
  );

  return {
    postHtml,
    postText: scored.plainText,
    seo: scored.seo,
    ai: scored.ai,
    overall: scored.overall,
    liveItems: scored.liveItems,
    buckets,
    remainingRows: remainingOpportunities(scored.liveItems),
  };
}

export function computeLiveArticleScores(input: LiveArticleScoresInput): LiveArticleScores {
  const scoringHtml = input.htmlForScoring ?? input.html;
  const scoringText = scoringHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const paraCount = paragraphCountFromHtml(scoringHtml);

  if (!input.scoreData) {
    const fb = input.fallbackScore ?? 0;
    return { seo: fb, ai: 0, overall: fb, hasAi: false };
  }

  const updatedTerms = input.scoreData.terms?.map((t) => ({
    ...t,
    current_count: countOccurrences(scoringText, t.term),
  }));

  const liveItems = input.coverageSnapshot?.items?.length
    ? liveCoverageItems(input.coverageSnapshot.items, scoringText, scoringHtml)
    : input.coverageItems;

  const seo = computeContentScore(
    scoringText,
    input.wordCount,
    input.headingCount,
    { ...input.scoreData, terms: updatedTerms ?? input.scoreData.terms },
    paraCount,
    input.internalLinksCount,
    scoringHtml,
    input.keyword,
    input.keywordCoverage,
    liveItems,
  );

  const intentScore = input.coverageSnapshot
    ? computeCoverageScores(liveItems, !!input.coverageSnapshot.answersMainQuestionEarly).buckets
      .find((b) => b.key === 'intent')?.score
    : undefined;

  const coverageOverall = input.coverageSnapshot?.items?.length
    ? computeCoverageScores(liveItems, !!input.coverageSnapshot.answersMainQuestionEarly).overall
    : null;

  const hasAi = coverageOverall != null
    || !!(input.aiVisibilitySummary && input.aiVisibilitySummary.prompts_total > 0);

  const ai = hasAi
    ? (coverageOverall != null && coverageOverall > 0
      ? coverageOverall
      : resolveAiScore({
        summary: input.aiVisibilitySummary,
        articleText: scoringText,
        intentScore,
        answersMainQuestionEarly: input.coverageSnapshot?.answersMainQuestionEarly,
        coverageOverall,
      }))
    : 0;

  const overall = hasAi ? computeOverallContentScore(seo, ai) : seo;

  return { seo, ai, overall, hasAi };
}

/**
 * Shared live scoring for editor / Auto-Optimize / save — one formula so gauges
 * never disagree across AO reviewing vs post-Save.
 */
import { computeContentScore, countOccurrences, type ScoreData } from './contentScore';
import { liveCoverageItems } from './liveCoverage';
import { computeCoverageScores, type CoverageItem, type CoverageSnapshot } from './aiCoverage';
import { computeOverallContentScore } from './aiSearchScore';

export type UnifiedArticleScores = {
  seo: number;
  ai: number;
  overall: number;
  words: number;
  headings: number;
  paragraphs: number;
  plainText: string;
  liveItems: CoverageItem[];
};

export function paragraphCountFromHtml(html: string): number {
  return (html.match(/<p[\s>]/gi) || []).length;
}

export function stripHtmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Score an HTML document with the same inputs AO live gauges use. */
export function scoreArticleHtml(opts: {
  html: string;
  scoreData: ScoreData;
  keyword: string;
  coverageItems?: readonly CoverageItem[];
  answersMainQuestionEarly?: boolean;
  internalLinksCount?: number;
}): UnifiedArticleScores {
  const html = opts.html || '';
  const plainText = stripHtmlToPlain(html);
  const words = plainText ? plainText.split(/\s+/).length : 0;
  const headings = (html.match(/<h[1-6][\s>]/gi) || []).length;
  const paragraphs = paragraphCountFromHtml(html);
  const internalLinks = opts.internalLinksCount
    ?? (html.match(/<a\s[^>]*href=/gi) || []).length;

  const baseItems = opts.coverageItems ?? [];
  const liveItems = baseItems.length
    ? [...liveCoverageItems(baseItems, plainText, html)]
    : [];
  const { overall: ai } = computeCoverageScores(
    liveItems,
    !!opts.answersMainQuestionEarly,
  );

  const updatedTerms = opts.scoreData.terms?.map((t) => ({
    ...t,
    current_count: countOccurrences(plainText, t.term),
  }));

  const seo = computeContentScore(
    plainText,
    words,
    headings,
    { ...opts.scoreData, terms: updatedTerms ?? opts.scoreData.terms },
    paragraphs,
    internalLinks,
    html,
    opts.keyword,
    undefined,
    liveItems.length ? liveItems : undefined,
  );

  const hasAi = liveItems.length > 0 || opts.scoreData.ai_score != null;
  const aiScore = liveItems.length > 0
    ? ai
    : (opts.scoreData.ai_score ?? 0);
  const overall = hasAi && (liveItems.length > 0 || (opts.scoreData.ai_score ?? 0) > 0)
    ? computeOverallContentScore(seo, aiScore)
    : seo;

  return {
    seo,
    ai: aiScore,
    overall,
    words,
    headings,
    paragraphs,
    plainText,
    liveItems,
  };
}

export function coverageAnswersEarly(snap: CoverageSnapshot | null | undefined): boolean {
  return !!snap?.answersMainQuestionEarly;
}

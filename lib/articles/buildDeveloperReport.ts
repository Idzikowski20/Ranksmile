/**
 * Developer dump of a live article editor state — JSON download for debugging
 * scores / terms / AI Search coverage.
 */
import { countOccurrences, termCoverage, type ScoreData } from '../contentScore';
import type { AiVisibilitySummary } from '../aiSearchScore';
import { computeOverallContentScore } from '../aiSearchScore';
import type { BucketScore, CoverageItem, CoverageSnapshot } from '../aiCoverage';
import { scoreArticleHtml } from '../scoreArticleHtml';

export type DeveloperReportArticleMeta = {
  id: number;
  domain_id: number;
  title: string;
  status: string;
  target_keyword: string;
  meta_title: string;
  meta_description: string;
  meta_url: string;
  language?: string;
  content_score?: number;
  word_count: number;
  featured_image: string | null;
  publish_target: string | null;
  publish_url: string | null;
  created_at?: string;
  updated_at?: string;
  score_data_raw: unknown;
  competitor_outlines_cache: unknown;
  ai_info_to_cover_raw: unknown;
  plagiarism_json: unknown;
  ai_readability_json: unknown;
};

export type DeveloperReportInput = {
  article: DeveloperReportArticleMeta;
  html: string;
  plainText: string;
  wordCount: number;
  headingCount: number;
  paragraphCount: number;
  internalLinksCount: number;
  scoreData: ScoreData;
  coverageItems: readonly CoverageItem[];
  coverageBuckets: readonly BucketScore[];
  coverageSnapshot: CoverageSnapshot | null;
  aiVisibilitySummary: AiVisibilitySummary | null;
  /** Persisted / panel AI score when live overall is null. */
  aiCoverageScore: number | null;
};

function safeParse(raw: unknown): unknown {
  if (raw == null) return null;
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export function buildDeveloperReport(input: DeveloperReportInput): Record<string, unknown> {
  const keyword = input.article.target_keyword || '';
  const scored = scoreArticleHtml({
    html: input.html,
    scoreData: input.scoreData,
    keyword,
    coverageItems: [...input.coverageItems],
    answersMainQuestionEarly: input.coverageSnapshot?.answersMainQuestionEarly,
    internalLinksCount: input.internalLinksCount,
  });

  const termsLive = (input.scoreData.terms || []).map((t) => {
    const current_count = countOccurrences(input.plainText, t.term, t.term_words_regexps);
    const coverage = termCoverage({ ...t, current_count });
    return {
      term: t.term,
      target_count: t.target_count,
      current_count,
      suggested_min: t.suggested_min,
      suggested_max: t.suggested_max,
      relevance: t.relevance,
      salience: t.salience,
      coverage,
      covered: coverage === 'green',
    };
  });

  const aiItems = scored.liveItems.length ? scored.liveItems : [...input.coverageItems];
  const aiCovered = aiItems.filter((i) => i.covered);
  const aiNotCovered = aiItems.filter((i) => !i.covered);

  const seo = scored.seo;
  const ai = scored.liveItems.length > 0
    ? scored.ai
    : (input.aiCoverageScore ?? input.scoreData.ai_score ?? 0);
  const overall = scored.liveItems.length > 0 || (input.scoreData.ai_score ?? 0) > 0 || input.aiCoverageScore != null
    ? computeOverallContentScore(seo, ai)
    : seo;

  return {
    generated_at: new Date().toISOString(),
    source: 'ranksmile-editor-developer-report',
    article: {
      id: input.article.id,
      domain_id: input.article.domain_id,
      title: input.article.title,
      status: input.article.status,
      target_keyword: input.article.target_keyword,
      language: input.article.language ?? null,
      meta_title: input.article.meta_title,
      meta_description: input.article.meta_description,
      meta_url: input.article.meta_url,
      featured_image: input.article.featured_image,
      publish_target: input.article.publish_target,
      publish_url: input.article.publish_url,
      created_at: input.article.created_at ?? null,
      updated_at: input.article.updated_at ?? null,
      persisted_content_score: input.article.content_score ?? null,
      persisted_word_count: input.article.word_count,
    },
    content: {
      html: input.html,
      plain_text: input.plainText,
      word_count: input.wordCount,
      heading_count: input.headingCount,
      paragraph_count: input.paragraphCount,
      internal_links_count: input.internalLinksCount,
    },
    scores: {
      seo,
      ai_search: ai,
      overall,
      live_from_scorer: {
        seo: scored.seo,
        ai: scored.ai,
        overall: scored.overall,
        words: scored.words,
        headings: scored.headings,
        paragraphs: scored.paragraphs,
      },
      persisted: {
        content_score: input.article.content_score ?? null,
        seo_score: input.scoreData.seo_score ?? null,
        ai_score: input.scoreData.ai_score ?? null,
        _computed_score: input.scoreData._computed_score ?? null,
        _content_score: input.scoreData._content_score ?? null,
        panel_ai_coverage_score: input.aiCoverageScore,
      },
    },
    terms: {
      total: termsLive.length,
      covered_count: termsLive.filter((t) => t.covered).length,
      not_covered_count: termsLive.filter((t) => !t.covered).length,
      covered: termsLive.filter((t) => t.covered),
      not_covered: termsLive.filter((t) => !t.covered),
      all: termsLive,
    },
    ai_search: {
      score: ai,
      answers_main_question_early: input.coverageSnapshot?.answersMainQuestionEarly ?? null,
      buckets: input.coverageBuckets,
      snapshot_overall: input.coverageSnapshot?.overall ?? null,
      items_total: aiItems.length,
      covered_count: aiCovered.length,
      not_covered_count: aiNotCovered.length,
      covered: aiCovered,
      not_covered: aiNotCovered,
      all_items: aiItems,
      visibility_summary: input.aiVisibilitySummary,
    },
    score_data: input.scoreData,
    raw: {
      score_data: safeParse(input.article.score_data_raw),
      competitor_outlines_cache: safeParse(input.article.competitor_outlines_cache),
      ai_info_to_cover: safeParse(input.article.ai_info_to_cover_raw),
      plagiarism: safeParse(input.article.plagiarism_json),
      ai_readability: safeParse(input.article.ai_readability_json),
      knowledge_graph: input.scoreData.knowledge_graph ?? null,
      knowledge_coverage_report: input.scoreData.knowledge_coverage_report ?? null,
      content_effort: input.scoreData.content_effort ?? null,
      audit_result: input.scoreData.audit_result ?? null,
      competitor_synthesis: input.scoreData.competitor_synthesis ?? null,
    },
  };
}

export function downloadDeveloperReport(report: Record<string, unknown>, articleId: number | string): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ranksmile-article-${articleId}-developer-report.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ponytail: ceiling = client snapshot only (no server re-fetch); upgrade = API /debug/report
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
  // eslint-disable-next-line no-console
  console.assert(
    termCoverage({ current_count: 3, target_count: 3 }) === 'green',
    'developer report term covered',
  );
}

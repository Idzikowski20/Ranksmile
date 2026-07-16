import db from '../database/database';
import { queryOne, queryRows } from './db/query';
import { getArticleIdSql } from './articleSql';
import { readArticleTerms } from './articleTerms';
import { enrichNlpTermsIfNeeded } from './articleKeywordDiscovery';
import { pickTermsForGeneratedArticle, mergeNlpTerms } from './pickArticleTerms';
import { termsForOptimize } from './mergeArticleTerms';
import { computeCoverageScores } from './aiCoverage';
import { computeOverallContentScore } from './aiSearchScore';
import { filterUsefulNlpTerms, isWeakTermList } from './competitorTermCalibration';
import { countOccurrences, computeContentScore, type NlpTerm, type ScoreData } from './contentScore';
import { parseSnapshot } from './coverageStore';
import { liveCoverageItems } from './liveCoverage';
import { filterNlpTermsForAnalysis } from './topicRelevance';
import { needsCoverageRegrade, regradeCoverageSnapshot } from './regradeCoverageSnapshot';
import { sidecarUrl } from './serviceUrls';
import { parseJsonish } from './types/json';
import { countryForLanguage } from './langCountry';
import axios from 'axios';

type ArticleRow = {
  score_data: string | null;
  ai_info_to_cover: string | null;
  target_keyword: string | null;
  language: string | null;
  domain_id: number | null;
};

function normalizeTerms(terms: NlpTerm[], plainText: string): NlpTerm[] {
  return terms.map((t) => ({
    ...t,
    suggested_min: t.suggested_min ?? Math.max(1, Math.round((t.target_count || 1) * 0.7)),
    suggested_max: t.suggested_max ?? Math.max(t.suggested_min ?? 1, Math.round((t.target_count || 1) * 1.5)),
    current_count: countOccurrences(plainText, t.term),
  }));
}

async function syncArticleTerms(articleId: number, terms: NlpTerm[], plainText: string): Promise<void> {
  await db.query('DELETE FROM article_terms WHERE article_id = ?', { replacements: [articleId] }).catch(() => {});
  for (const t of terms) {
    await db.query(
      `INSERT INTO article_terms (article_id, term, term_type, source, current_count, target_min, target_max, importance, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      {
        replacements: [
          articleId,
          t.term,
          'topic',
          'serp',
          countOccurrences(plainText, t.term),
          t.suggested_min ?? Math.max(1, Math.round((t.target_count || 1) * 0.7)),
          t.suggested_max ?? Math.max(1, Math.round((t.target_count || 1) * 1.5)),
          t.target_count || 1,
        ],
      },
    ).catch(() => {});
  }
}

export type ReconcilePostGenerateResult = {
  scoreData: ScoreData;
  aiInfoToCover: string | null;
  contentScore: number;
};

/** After sidecar generation, restore enriched terms + re-score AI coverage on real HTML. */
export async function reconcilePostGenerateArticle(opts: {
  articleId: number;
  html: string;
  sidecarScoreData: ScoreData;
}): Promise<ReconcilePostGenerateResult> {
  const articleIdSql = await getArticleIdSql();
  const row = await queryOne<ArticleRow>(
    `SELECT score_data, ai_info_to_cover, target_keyword, language, domain_id
     FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
    [opts.articleId],
  );

  const keyword = (row?.target_keyword || '').trim();
  const plainText = opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const headingCount = (opts.html.match(/<h[1-6][^>]*>/gi) || []).length;
  const paragraphCount = plainText.split(/\n\n+/).filter((p) => p.trim().length > 0).length;
  const linkCount = (opts.html.match(/<a\s[^>]*href=/gi) || []).length;

  const existingScore: ScoreData = parseJsonish<ScoreData>(row?.score_data) ?? {
    terms: [],
    words_target: 0,
    words_min: 0,
    words_max: 0,
    headings_target: 0,
    headings_min: 0,
    headings_max: 0,
  };
  const incomingScore = opts.sidecarScoreData;
  const tableRows = await readArticleTerms(opts.articleId).catch(() => []);
  const tableTerms: NlpTerm[] = tableRows.map((r) => ({
    term: r.term,
    target_count: r.importance || r.target_max || 1,
    suggested_min: r.target_min,
    suggested_max: r.target_max,
    current_count: r.current_count,
  }));

  let terms = termsForOptimize({
    scoreDataTerms: [
      ...(existingScore.terms || []),
      ...(incomingScore.terms || []),
      ...tableTerms,
    ],
    tableTerms: tableRows,
  });
  if (keyword && isWeakTermList(terms, keyword)) {
    terms = pickTermsForGeneratedArticle(
      terms,
      incomingScore.terms || [],
      keyword,
    );
  }

  if (keyword) {
    const competitorRows = await queryRows<{ domain: string; url: string }>(
      `SELECT domain, url FROM article_competitors WHERE article_id = ?`,
      [opts.articleId],
    ).catch(() => []);
    const competitorDomains = competitorRows.map((r) => r.domain).filter(Boolean);
    const competitorUrls = competitorRows.map((r) => r.url).filter(Boolean);

    terms = await enrichTermsForArticle({
      terms,
      keyword,
      language: row?.language,
      competitorDomains,
      competitorUrls,
      plainText,
    });
  }

  terms = normalizeTerms(terms, plainText);

  const scoreData: ScoreData = {
    ...existingScore,
    ...incomingScore,
    terms,
    words_target: incomingScore.words_target || existingScore.words_target || 2000,
    words_min: incomingScore.words_min || existingScore.words_min || 1500,
    words_max: incomingScore.words_max || existingScore.words_max || 2500,
    headings_target: incomingScore.headings_target || existingScore.headings_target || 15,
    headings_min: incomingScore.headings_min || existingScore.headings_min || 10,
    headings_max: incomingScore.headings_max || existingScore.headings_max || 25,
  };

  const snap = parseSnapshot(row?.ai_info_to_cover);
  let aiInfoToCover: string | null = row?.ai_info_to_cover ?? null;
  let coverageItems = snap?.items ? [...snap.items] : [];

  let activeSnap = snap;
  if (snap && keyword) {
    const regaded = await regradeCoverageSnapshot({
      snapshot: snap,
      plainText,
      html: opts.html,
      keyword,
    }).catch((err) => {
      console.warn('[reconcile] coverage regrade failed:', err instanceof Error ? err.message : err);
      return null;
    });
    if (regaded) {
      activeSnap = regaded;
      aiInfoToCover = JSON.stringify(regaded);
      coverageItems = [...regaded.items];
    }
  }

  if (activeSnap?.items?.length) {
    const liveItems = liveCoverageItems(activeSnap.items, plainText, opts.html);
    const { overall, buckets } = computeCoverageScores(liveItems, !!activeSnap.answersMainQuestionEarly);
    const updatedSnap = {
      ...activeSnap,
      items: [...liveItems],
      buckets,
      overall,
    };
    aiInfoToCover = JSON.stringify(updatedSnap);
    coverageItems = [...liveItems];
    scoreData.ai_score = overall;
  }

  const seoScore = computeContentScore(
    plainText,
    wordCount,
    headingCount,
    scoreData,
    paragraphCount,
    linkCount,
    opts.html,
    keyword,
    undefined,
    coverageItems,
  );
  scoreData.seo_score = seoScore;
  scoreData._computed_score = computeOverallContentScore(seoScore, scoreData.ai_score ?? 0);
  scoreData._content_score = scoreData._computed_score;
  scoreData._heading_count = headingCount;
  scoreData._paragraph_count = paragraphCount;

  if (terms.length) {
    await syncArticleTerms(opts.articleId, terms, plainText);
  }

  return {
    scoreData,
    aiInfoToCover,
    contentScore: scoreData._computed_score ?? seoScore,
  };
}

async function fetchCompetitorCorpusTerms(keyword: string, urls: string[]): Promise<NlpTerm[]> {
  if (!urls.length) return [];
  const base = sidecarUrl();
  try {
    const res = await axios.post(
      `${base}/extract-terms-from-urls`,
      { keyword, urls },
      {
        timeout: 180000,
        headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' },
      },
    );
    const terms = (res.data?.terms || []) as Array<{ term: string; target_count?: number; relevance?: number }>;
    return terms
      .filter((t) => t.term)
      .map((t) => ({
        term: t.term,
        target_count: t.target_count ?? 1,
        relevance: t.relevance,
      }));
  } catch (err) {
    console.warn('[reconcile] extract-terms-from-urls failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

async function fetchSerpNlpTerms(keyword: string, language: string): Promise<NlpTerm[]> {
  const base = sidecarUrl();
  try {
    const res = await axios.post(
      `${base}/analyze-serp`,
      { keyword, language },
      {
        timeout: 120000,
        headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' },
      },
    );
    const terms = (res.data?.terms || []) as Array<{ term: string; target_count?: number; relevance?: number }>;
    return terms
      .filter((t) => t.term)
      .map((t) => ({
        term: t.term,
        target_count: t.target_count ?? 1,
        relevance: t.relevance,
      }));
  } catch (err) {
    console.warn('[reconcile] analyze-serp fallback failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

async function enrichTermsForArticle(opts: {
  terms: NlpTerm[];
  keyword: string;
  language?: string | null;
  competitorDomains: string[];
  competitorUrls: string[];
  plainText: string;
}): Promise<NlpTerm[]> {
  const country = countryForLanguage(opts.language);
  const languageCode = (opts.language || 'pl').toLowerCase().split(/[-_]/)[0];

  let terms = opts.terms;
  if (!needsEnrichment(terms, opts.keyword)) return terms;

  terms = await enrichNlpTermsIfNeeded({
    terms,
    primaryKeyword: opts.keyword,
    country,
    languageCode,
    competitorDomains: opts.competitorDomains,
    plainText: opts.plainText,
  });
  terms = filterNlpTermsForAnalysis(filterUsefulNlpTerms(terms), opts.keyword);

  if (needsEnrichment(terms, opts.keyword)) {
    const serpTerms = await fetchSerpNlpTerms(opts.keyword, languageCode);
    if (serpTerms.length) {
      terms = pickTermsForGeneratedArticle(terms, serpTerms, opts.keyword);
      terms = filterNlpTermsForAnalysis(filterUsefulNlpTerms(terms), opts.keyword);
    }
  }

  if (needsEnrichment(terms, opts.keyword)) {
    const corpusTerms = await fetchCompetitorCorpusTerms(opts.keyword, opts.competitorUrls);
    if (corpusTerms.length) {
      terms = mergeNlpTerms(filterUsefulNlpTerms(terms), filterUsefulNlpTerms(corpusTerms));
      // Corpus scrape is the authoritative source — do not re-filter with seed-token rules.
      if (terms.length >= 12) return terms;
    }
  }

  if (needsEnrichment(terms, opts.keyword)) {
    terms = await enrichNlpTermsIfNeeded({
      terms,
      primaryKeyword: opts.keyword,
      country,
      languageCode,
      competitorDomains: opts.competitorDomains,
      plainText: opts.plainText,
    });
    terms = filterNlpTermsForAnalysis(filterUsefulNlpTerms(terms), opts.keyword);
  }

  return terms;
}

function needsEnrichment(terms: NlpTerm[], keyword: string): boolean {
  return isWeakTermList(terms, keyword);
}

/** Fix articles where generate overwrote deep-analysis terms with thin sidecar SERP splits. */
export async function repairWeakArticleScoreData(opts: {
  articleId: number;
  html: string;
}): Promise<ReconcilePostGenerateResult | null> {
  const articleIdSql = await getArticleIdSql();
  const row = await queryOne<ArticleRow>(
    `SELECT score_data, ai_info_to_cover, target_keyword, language, domain_id
     FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
    [opts.articleId],
  );
  const keyword = (row?.target_keyword || '').trim();
  const scoreData = parseJsonish<ScoreData>(row?.score_data);
  const tableRows = await readArticleTerms(opts.articleId).catch(() => []);
  const hasRichTable = tableRows.length >= 12;
  const termsWeak = !scoreData?.terms?.length || isWeakTermList(scoreData.terms, keyword);
  const snap = parseSnapshot(row?.ai_info_to_cover);
  const plainText = opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const coverageStale = snap ? needsCoverageRegrade(snap, plainText) : false;
  if (!termsWeak && !hasRichTable && !coverageStale) return null;

  const incoming = scoreData ?? {
    terms: [],
    words_target: 2000,
    words_min: 1500,
    words_max: 2500,
    headings_target: 15,
    headings_min: 10,
    headings_max: 20,
  };

  return reconcilePostGenerateArticle({
    articleId: opts.articleId,
    html: opts.html,
    sidecarScoreData: incoming,
  });
}

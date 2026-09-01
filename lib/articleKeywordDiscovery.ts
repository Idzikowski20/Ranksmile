/**
 * Discover ranking keywords for an imported article page.
 * Primary source: DataForSEO ranked keywords from SERP competitors.
 * GSC is validation-only (page queries that match the URL anchor).
 */
import db from '../database/database';
import { cached, TTL } from './cache/fileCache';
import { enrichTerms, getOwnVisibleKeywords } from './seo/keywordData';
import { getRankedKeywords, isDataForSeoConfigured } from './dataforseo';
import { DFS_DEFAULT_RANKED_LIMIT } from './dataforseoBudget';
import { computeRelevanceScore, checkCoverage } from './keywordEnrichment';
import type { NlpTerm } from './contentScore';
import { isWeakTermList } from './competitorTermCalibration';
import { filterOnTopicTerms, isKeywordOnTopic } from './topicRelevance';
import { isDictionaryQueryNoise } from './termUtils';
import { keywordFromUrl, urlAnchorSeed } from './inferPageKeyword';
import { kwScore } from '../utils/gsc';

export type DiscoveredKeyword = {
  keyword: string;
  position?: number;
  impressions?: number;
  clicks?: number;
  source: 'gsc' | 'dataforseo' | 'user';
};

export function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function passesKeywordGate(kw: string, anchorSeed: string, source: DiscoveredKeyword['source']): boolean {
  const k = kw.trim();
  if (!k || isDictionaryQueryNoise(k)) return false;
  if (source === 'user') return true;
  if (!anchorSeed) return false;
  return isKeywordOnTopic(k, anchorSeed);
}

function keywordSortScore(k: DiscoveredKeyword): number {
  if (k.source === 'dataforseo') {
    return 2000 - Math.min(k.position ?? 50, 50) * 20;
  }
  if (k.source === 'user') return 1500;
  return 500 + kwScore(k);
}

/** True when the term list is too thin, stopword-heavy, or mostly trivial PK splits. */
export function needsTermEnrichment(terms: NlpTerm[], primaryKeyword: string): boolean {
  if (isWeakTermList(terms, primaryKeyword)) return true;

  const pk = (primaryKeyword || '').toLowerCase().trim();
  if (!pk) return terms.length < 20;

  const pkWords = pk.split(/\s+/).filter((w) => w.length >= 3);
  const trivial = terms.filter((t) => {
    const term = t.term.toLowerCase().trim();
    if (term === pk) return true;
    if (pkWords.length && pkWords.includes(term)) return true;
    if (term.split(/\s+/).length === 1 && pk.includes(term) && term.length >= 4) return true;
    return false;
  });

  return trivial.length / terms.length >= 0.35;
}

/** Merge NLP terms — keep higher target_count on duplicates. */
export function mergeNlpTerms(existing: NlpTerm[], incoming: NlpTerm[]): NlpTerm[] {
  const map = new Map<string, NlpTerm>();

  for (const t of existing) {
    const k = t.term.toLowerCase().trim();
    if (k) map.set(k, t);
  }

  for (const t of incoming) {
    const k = t.term.toLowerCase().trim();
    if (!k) continue;
    const prev = map.get(k);
    if (!prev || (t.target_count || 0) > (prev.target_count || 0)) {
      map.set(k, { ...t, term: k, current_count: prev?.current_count ?? t.current_count ?? 0 });
    }
  }

  return [...map.values()];
}

async function rankedKeywordsForDomain(
  domain: string,
  country?: string,
  languageCode?: string,
  cacheNs = 'discover-ranked',
): Promise<Array<{ keyword: string; position?: number }>> {
  return cached({
    namespace: cacheNs,
    key: [domain.toLowerCase(), country || 'US', languageCode || 'en'],
    ttlMs: TTL.RANKED_KEYWORDS,
    producer: async () => {
      const rows = await getRankedKeywords({
        target: domain,
        country,
        languageCode,
        limit: DFS_DEFAULT_RANKED_LIMIT,
        topOnly: true,
        maxRankGroup: 15,
      });
      return rows.map((row) => ({
        keyword: row.keyword,
        position: row.position ?? undefined,
      }));
    },
  });
}

/**
 * Competitor-first keyword discovery: URL anchor → DFS competitor footprint → GSC validation.
 */
export async function discoverRankingKeywords(opts: {
  pageUrl: string;
  workspaceDomain: string;
  userKeywords?: string[];
  country?: string;
  languageCode?: string;
  competitorDomains?: string[];
}): Promise<{ primaryKeyword: string; keywords: DiscoveredKeyword[] }> {
  const userKw = (opts.userKeywords || []).map((k) => k.trim()).filter(Boolean);
  const pageHost = hostFromUrl(opts.pageUrl);
  const wsDomain = (opts.workspaceDomain || '').replace(/^www\./, '');
  const gscDomain = wsDomain || pageHost;
  const urlSeed = urlAnchorSeed(opts.pageUrl) || keywordFromUrl(opts.pageUrl);
  const anchorSeed = userKw[0] || urlSeed || '';

  const found = new Map<string, DiscoveredKeyword>();

  const add = (kw: string, patch: Partial<DiscoveredKeyword> & { source: DiscoveredKeyword['source'] }) => {
    const k = kw.trim();
    if (!k) return;
    const lk = k.toLowerCase();
    const prev = found.get(lk);
    if (!prev || (patch.impressions || 0) > (prev.impressions || 0)) {
      found.set(lk, { keyword: k, ...prev, ...patch });
    }
  };

  for (const k of userKw) add(k, { source: 'user' });

  const ownDomain = pageHost || wsDomain;
  const competitors = (opts.competitorDomains || [])
    .map((d) => d.replace(/^www\./, '').toLowerCase())
    .filter((d) => d && d !== ownDomain.replace(/^www\./, '').toLowerCase())
    .slice(0, 3);

  const addRankedOnTopic = async (domain: string, cacheNs: string) => {
    if (!domain || !anchorSeed || !isDataForSeoConfigured()) return;
    try {
      const ranked = await rankedKeywordsForDomain(domain, opts.country, opts.languageCode, cacheNs);
      for (const r of ranked) {
        if (!r.keyword || !isKeywordOnTopic(r.keyword, anchorSeed)) continue;
        add(r.keyword, { source: 'dataforseo', position: r.position ?? undefined });
      }
    } catch { /* non-fatal */ }
  };

  // Competitors first — Ranksmile-style SERP footprint, not whole-domain noise.
  for (const comp of competitors) {
    await addRankedOnTopic(comp, `discover-ranked-comp-${comp}`);
  }
  if (!competitors.length && ownDomain) {
    await addRankedOnTopic(ownDomain, 'discover-ranked-own');
  }

  // GSC validation — only queries on-topic for the URL anchor.
  try {
    const gsc = await getOwnVisibleKeywords({ domain: gscDomain, page: opts.pageUrl });
    for (const row of gsc.keywords) {
      if (!passesKeywordGate(row.keyword, anchorSeed, 'gsc')) continue;
      add(row.keyword, {
        source: 'gsc',
        position: row.position,
        impressions: row.impressions,
        clicks: row.clicks,
      });
    }
  } catch { /* GSC optional */ }

  const keywords = [...found.values()]
    .filter((k) => passesKeywordGate(k.keyword, anchorSeed, k.source))
    .sort((a, b) => keywordSortScore(b) - keywordSortScore(a));

  const dfsBest = keywords.find((k) => k.source === 'dataforseo');
  const gscBest = keywords.find((k) => k.source === 'gsc');
  const primaryKeyword = userKw[0]
    || urlSeed
    || dfsBest?.keyword
    || gscBest?.keyword
    || keywords[0]?.keyword
    || '';

  return { primaryKeyword, keywords };
}

/** Upsert discovered keywords into article_keywords. */
export async function saveArticleKeywords(
  articleId: number,
  keywords: DiscoveredKeyword[],
  targetKeyword: string,
  plainText: string,
): Promise<void> {
  const isPostgres = !!process.env.DATABASE_URL;
  const anchor = targetKeyword.trim() || '';
  const toSave = keywords.filter((row) => {
    if (isDictionaryQueryNoise(row.keyword)) return false;
    if (row.source === 'user') return true;
    if (!anchor) return false;
    return isKeywordOnTopic(row.keyword, anchor);
  }).slice(0, 80);

  for (const row of toSave) {
    const uid = `${articleId}:${row.keyword}`;
    const relevance = computeRelevanceScore(row.keyword, targetKeyword);
    const covered = checkCoverage(row.keyword, plainText || '') ? 1 : 0;

    if (isPostgres) {
      await db.query(
        `INSERT INTO article_keywords (article_id, keyword, relevance_score, is_covered, gsc_position, uid, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT (uid) DO UPDATE SET
           relevance_score = GREATEST(article_keywords.relevance_score, EXCLUDED.relevance_score),
           is_covered = EXCLUDED.is_covered,
           gsc_position = COALESCE(EXCLUDED.gsc_position, article_keywords.gsc_position),
           updated_at = CURRENT_TIMESTAMP`,
        { replacements: [articleId, row.keyword, relevance, covered, row.position ?? null, uid] },
      ).catch(() => {});
    } else {
      await db.query(
        `INSERT OR REPLACE INTO article_keywords (id, article_id, keyword, relevance_score, is_covered, gsc_position, uid, updated_at)
         VALUES ((SELECT id FROM article_keywords WHERE uid = ?), ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        { replacements: [uid, articleId, row.keyword, relevance, covered, row.position ?? null, uid] },
      ).catch(() => {});
    }
  }
}

/** Enrich thin NLP term lists via DataForSEO (suggestions + competitor footprint). */
export async function enrichNlpTermsIfNeeded(opts: {
  terms: NlpTerm[];
  primaryKeyword: string;
  country?: string;
  languageCode?: string;
  competitorDomains?: string[];
  ownDomain?: string;
  plainText?: string;
  signal?: AbortSignal;
}): Promise<NlpTerm[]> {
  if (!needsTermEnrichment(opts.terms, opts.primaryKeyword)) return opts.terms;

  const { terms: enriched } = await enrichTerms({
    keyword: opts.primaryKeyword,
    country: opts.country,
    languageCode: opts.languageCode,
    ownDomain: opts.ownDomain,
    competitorDomains: opts.competitorDomains,
    limit: 80,
    signal: opts.signal,
  });

  if (!enriched.length) return opts.terms;

  const asNlp: NlpTerm[] = enriched.map((t) => ({
    term: t.term,
    target_count: t.target_count,
    current_count: opts.plainText ? (opts.plainText.toLowerCase().split(t.term.toLowerCase()).length - 1) : 0,
  }));

  const onTopic = filterOnTopicTerms(asNlp, opts.primaryKeyword);
  if (!onTopic.length) return opts.terms;

  return mergeNlpTerms(opts.terms, onTopic);
}

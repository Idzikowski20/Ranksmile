/**

 * Discover real ranking keywords for an imported/ranked article page.

 * Combines GSC (first-party, page-specific), DataForSEO ranked keywords, and user seeds.

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
import { keywordFromUrl } from './inferPageKeyword';
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
    producer: () => getRankedKeywords({
      target: domain,
      country,
      languageCode,
      limit: DFS_DEFAULT_RANKED_LIMIT,
      topOnly: true,
      maxRankGroup: 15,
    }),
  });
}

/**

 * Fetch keywords the page ranks for (GSC) plus on-topic competitor / domain gaps (DFS).
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

  try {
    const gsc = await getOwnVisibleKeywords({ domain: gscDomain, page: opts.pageUrl });
    for (const row of gsc.keywords) {
      add(row.keyword, {
        source: 'gsc',
        position: row.position,
        impressions: row.impressions,
        clicks: row.clicks,
      });
    }
  } catch { /* GSC optional */ }

  const gscOnly = [...found.values()].filter((k) => k.source === 'gsc');
  const bestGsc = gscOnly.sort((a, b) => kwScore(b) - kwScore(a))[0]?.keyword;

  const seedForFilter = userKw[0] || bestGsc || keywordFromUrl(opts.pageUrl) || '';

  const addRankedOnTopic = async (domain: string, cacheNs: string) => {
    if (!domain || !seedForFilter || !isDataForSeoConfigured()) return;
    try {
      const ranked = await rankedKeywordsForDomain(domain, opts.country, opts.languageCode, cacheNs);
      for (const r of ranked) {
        if (!r.keyword || !isKeywordOnTopic(r.keyword, seedForFilter)) continue;
        add(r.keyword, { source: 'dataforseo', position: r.position ?? undefined });
      }
    } catch { /* non-fatal */ }
  };

  const ownDomain = pageHost || wsDomain;
  const competitors = (opts.competitorDomains || [])
    .map((d) => d.replace(/^www\./, '').toLowerCase())
    .filter((d) => d && d !== ownDomain.replace(/^www\./, '').toLowerCase())
    .slice(0, 3);

  // On-topic domain footprint — never dump the whole domain when we lack a seed.
  if (ownDomain) await addRankedOnTopic(ownDomain, 'discover-ranked-own');
  for (const comp of competitors) {
    await addRankedOnTopic(comp, `discover-ranked-comp-${comp}`);
  }

  const keywords = [...found.values()]
    .filter((k) => {
      if (k.source === 'gsc' || k.source === 'user') return true;
      if (!seedForFilter) return false;
      return isKeywordOnTopic(k.keyword, seedForFilter);
    })
    .sort((a, b) => {
      const score = (k: DiscoveredKeyword) => kwScore(k) + (k.source === 'gsc' ? 500 : 0);
      return score(b) - score(a);
    });

  const primaryKeyword = userKw[0]
    || keywords.find((k) => k.source === 'gsc')?.keyword
    || seedForFilter
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

  for (const row of keywords.slice(0, 80)) {

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

}): Promise<NlpTerm[]> {

  if (!needsTermEnrichment(opts.terms, opts.primaryKeyword)) return opts.terms;

  const { terms: enriched } = await enrichTerms({

    keyword: opts.primaryKeyword,

    country: opts.country,

    languageCode: opts.languageCode,

    ownDomain: opts.ownDomain,

    competitorDomains: opts.competitorDomains,

    limit: 80,

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


/**
 * Hybrid keyword-data router — picks the cheapest accurate source per request:
 *
 *   getKeywordIdeas       → DataForSEO Labs   (ideas + volume + difficulty)  cached 30d
 *   getOwnVisibleKeywords → Google Search Console (free, first-party)        live
 *   getKeywordGap         → DataForSEO Labs   (competitor ranked − own)      cached 7d
 *
 * Everything paid is wrapped in `cached()` so repeat lookups cost nothing until
 * the TTL expires. When DataForSEO is not configured, the paid branches return
 * `{ source: 'none', keywords: [] }` and the caller falls back to the free stack
 * (serper / autocomplete / pytrends in the sidecar).
 */
import { cached, TTL } from '../cache/fileCache';
import {
   isDataForSeoConfigured, getKeywordIdeas as dfsKeywordIdeas,
   getKeywordSuggestions as dfsKeywordSuggestions, getRankedKeywords, getPeopleAlsoAsk, DfsKeyword,
} from '../dataforseo';
import { readLocalSCData } from '../../utils/searchConsole';
import { AiVisibilitySummary } from '../aiSearchScore';

export type KeywordSource = 'dataforseo' | 'gsc' | 'none';

export type KeywordMetric = {
   keyword: string,
   search_volume: number | null,
   keyword_difficulty: number | null,
   competition_level: string | null,
   cpc: number | null,
   search_intent: string | null,
};

export type VisibleKeyword = {
   keyword: string,
   page: string,
   position: number,
   impressions: number,
   clicks: number,
};

const toMetric = (k: DfsKeyword): KeywordMetric => ({
   keyword: k.keyword,
   search_volume: k.search_volume,
   keyword_difficulty: k.keyword_difficulty,
   competition_level: k.competition_level,
   cpc: k.cpc,
   search_intent: k.search_intent,
});

/**
 * Keyword ideas + volume + difficulty for a seed keyword.
 * Source: DataForSEO Labs, cached 30 days (volume/difficulty barely move).
 */
export async function getKeywordIdeas(opts: {
   seed: string,
   country?: string,
   languageCode?: string,
   limit?: number,
}): Promise<{ source: KeywordSource, keywords: KeywordMetric[] }> {
   if (!isDataForSeoConfigured()) { return { source: 'none', keywords: [] }; }

   const keywords = await cached({
      namespace: 'kw-ideas',
      key: [opts.seed.toLowerCase(), opts.country || 'US', opts.languageCode || 'en', opts.limit || 700],
      ttlMs: TTL.KEYWORD_METRICS,
      producer: () => dfsKeywordIdeas({
         keywords: [opts.seed],
         country: opts.country,
         languageCode: opts.languageCode,
         limit: opts.limit,
      }),
   });
   return { source: 'dataforseo', keywords: keywords.map(toMetric) };
}

/**
 * Keyword SUGGESTIONS — full-phrase expansions that CONTAIN the seed (e.g.
 * "śledzenie" → "dhl śledzenie", "śledzenie przesyłki"). Use this for typeahead;
 * it stays on-topic, unlike keyword_ideas which drifts to category-relevant terms.
 * Source: DataForSEO Labs, cached 30 days.
 */
export async function getKeywordSuggestions(opts: {
   seed: string,
   country?: string,
   languageCode?: string,
   limit?: number,
}): Promise<{ source: KeywordSource, keywords: KeywordMetric[] }> {
   if (!isDataForSeoConfigured()) { return { source: 'none', keywords: [] }; }

   const keywords = await cached({
      namespace: 'kw-suggest',
      key: [opts.seed.toLowerCase(), opts.country || 'US', opts.languageCode || 'en', opts.limit || 700],
      ttlMs: TTL.KEYWORD_METRICS,
      producer: () => dfsKeywordSuggestions({
         keyword: opts.seed,
         country: opts.country,
         languageCode: opts.languageCode,
         limit: opts.limit,
      }),
   });
   return { source: 'dataforseo', keywords: keywords.map(toMetric) };
}

/**
 * Term ENRICHMENT for weak entity lists. Pulls real keyword data when competitor
 * text-extraction came back thin, so we cover relevant entities instead of
 * placeholders. Combines:
 *   - keyword_ideas      → related entities + search volume for the seed
 *   - ranked_keywords    → what the top competitor domains actually rank for
 * Results are filtered to stay on-topic (must share a token with the seed) and
 * deduped. target_count is a modest discovery default (no real density evidence):
 * 1–2 word terms → 3×, 3 words → 2×, longer → 1×. Cached via the underlying calls.
 */
export async function enrichTerms(opts: {
   keyword: string,
   country?: string,
   languageCode?: string,
   competitorDomains?: string[],
   limit?: number,
}): Promise<{ source: KeywordSource, terms: Array<{ term: string, target_count: number }> }> {
   if (!isDataForSeoConfigured() || !opts.keyword.trim()) { return { source: 'none', terms: [] }; }

   const seedTokens = opts.keyword.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
   const isRelevant = (kw: string) => {
      if (!seedTokens.length) return true;
      const words = kw.toLowerCase().split(/\s+/);
      return seedTokens.some((st) => words.some((w) => w.includes(st) || st.includes(w)));
   };
   const targetFor = (kw: string) => {
      const wc = kw.trim().split(/\s+/).length;
      if (wc <= 2) return 3;
      if (wc === 3) return 2;
      return 1;
   };

   const domains = (opts.competitorDomains || []).filter(Boolean).slice(0, 3);
   const [suggestions, ideas, ...rankedLists] = await Promise.all([
      getKeywordSuggestions({ seed: opts.keyword, country: opts.country, languageCode: opts.languageCode, limit: 300 })
         .then((r) => r.keywords).catch(() => [] as KeywordMetric[]),
      getKeywordIdeas({ seed: opts.keyword, country: opts.country, languageCode: opts.languageCode, limit: 300 })
         .then((r) => r.keywords).catch(() => [] as KeywordMetric[]),
      ...domains.map((d) => cached({
         namespace: 'ranked',
         key: [d.toLowerCase(), opts.country || 'US', opts.languageCode || 'en'],
         ttlMs: TTL.RANKED_KEYWORDS,
         producer: () => getRankedKeywords({ target: d, country: opts.country, languageCode: opts.languageCode, limit: 200, topOnly: true }),
      }).then((ks) => ks.map(toMetric)).catch(() => [] as KeywordMetric[])),
   ]);

   // Suggestions first (phrase-match, most on-topic), then ideas, then competitor footprint.
   const pool: KeywordMetric[] = [...suggestions, ...ideas, ...rankedLists.flat()];
   const seen = new Set<string>();
   const scored = pool
      .filter((k) => k.keyword && isRelevant(k.keyword))
      .filter((k) => { const lk = k.keyword.toLowerCase(); if (seen.has(lk)) return false; seen.add(lk); return true; })
      .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
      .slice(0, opts.limit || 80)
      .map((k) => ({ term: k.keyword.toLowerCase(), target_count: targetFor(k.keyword) }));

   return { source: 'dataforseo', terms: scored };
}

const AI_STOP = new Set(['jak', 'czy', 'co', 'ile', 'gdzie', 'kiedy', 'dlaczego', 'które', 'która', 'który', 'jakie', 'jaki', 'oraz', 'dla', 'the', 'and', 'for', 'what', 'how', 'why', 'where', 'when', 'who', 'does', 'are', 'with']);

/**
 * AI Search "info to cover" from DataForSEO — People Also Ask + related searches.
 * Each question becomes a citation-style item; "covered" is computed from how much
 * of the question's vocabulary the article text already contains. Returns an
 * AiVisibilitySummary so the existing editor UI (info-to-cover list, AI score gauge)
 * consumes it unchanged. Null when DataForSEO is unconfigured or has no PAA data.
 */
export async function getAiSearchInfo(opts: {
   keyword: string,
   articleText: string,
   ownDomain?: string,
   country?: string,
   languageCode?: string,
}): Promise<AiVisibilitySummary | null> {
   if (!isDataForSeoConfigured() || !opts.keyword.trim()) return null;

   const paa = await cached({
      namespace: 'paa',
      key: [opts.keyword.toLowerCase(), opts.country || 'US', opts.languageCode || 'en'],
      ttlMs: TTL.RANKED_KEYWORDS,
      producer: () => getPeopleAlsoAsk({ keyword: opts.keyword, country: opts.country, languageCode: opts.languageCode }),
   }).catch(() => ({ questions: [] as Array<{ question: string; answer: string; domain: string; url: string }>, related: [] as string[] }));

   if (!paa.questions.length) return null;

   const text = (opts.articleText || '').toLowerCase();
   const own = (opts.ownDomain || '').replace(/^www\./, '').toLowerCase();

   const citations = paa.questions.map((q) => {
      const words = q.question.toLowerCase().replace(/[^\wąćęłńóśźż\s]/g, ' ').split(/\s+/)
         .filter((w) => w.length >= 4 && !AI_STOP.has(w));
      const matched = words.filter((w) => text.includes(w)).length;
      const readiness = words.length ? Math.round((matched / words.length) * 100) : 0;
      const isOwn = !!(own && q.domain && q.domain.replace(/^www\./, '').toLowerCase().includes(own));
      return {
         prompt: q.question,
         answer: q.answer,
         cited_url: q.url,
         cited_domain: q.domain,
         is_own_domain: isOwn,
         is_competitor: !!q.domain && !isOwn,
         answer_readiness_score: readiness,
      };
   });

   const cited = citations.filter((c) => c.answer_readiness_score >= 60).length;
   const competitor = citations.filter((c) => c.is_competitor).length;
   const extractability = Math.round(citations.reduce((s, c) => s + c.answer_readiness_score, 0) / citations.length);

   return {
      prompts_total: citations.length,
      prompts_cited: cited,
      competitor_citations: competitor,
      extractability_score: extractability,
      citations,
   };
}

/**
 * Keywords the user's OWN domain is visible for — from Google Search Console.
 * Free, exact (first-party Google data). Optionally filtered to one page/URL.
 */
export async function getOwnVisibleKeywords(opts: {
   domain: string,
   page?: string,
}): Promise<{ source: KeywordSource, keywords: VisibleKeyword[] }> {
   const scData = await readLocalSCData(opts.domain);
   if (!scData || !Array.isArray(scData.thirtyDays)) {
      return { source: 'gsc', keywords: [] };
   }

   const pageFilter = opts.page ? opts.page.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
   const keywords: VisibleKeyword[] = scData.thirtyDays
      .filter((item) => (pageFilter ? (item.page || '').includes(pageFilter) : true))
      .map((item) => ({
         keyword: item.keyword,
         page: item.page,
         position: item.position,
         impressions: item.impressions,
         clicks: item.clicks,
      }));

   return { source: 'gsc', keywords };
}

/**
 * Keyword gap: keywords a competitor ranks for (top 10) that the client does NOT.
 * Computed as a set difference of two cached Ranked-Keywords calls so the
 * semantics are explicit and each domain's ranked set is reused across gaps.
 */
export async function getKeywordGap(opts: {
   clientDomain: string,
   competitorDomain: string,
   country?: string,
   languageCode?: string,
   limit?: number,
}): Promise<{ source: KeywordSource, keywords: KeywordMetric[] }> {
   if (!isDataForSeoConfigured()) { return { source: 'none', keywords: [] }; }

   const ranked = (target: string) => cached({
      namespace: 'ranked',
      key: [target.toLowerCase(), opts.country || 'US', opts.languageCode || 'en'],
      ttlMs: TTL.RANKED_KEYWORDS,
      producer: () => getRankedKeywords({
         target, country: opts.country, languageCode: opts.languageCode, limit: opts.limit || 1000, topOnly: true,
      }),
   });

   const [competitor, client] = await Promise.all([
      ranked(opts.competitorDomain),
      ranked(opts.clientDomain),
   ]);

   const clientSet = new Set(client.map((k) => k.keyword.toLowerCase()));
   const gap = competitor.filter((k) => !clientSet.has(k.keyword.toLowerCase()));
   return { source: 'dataforseo', keywords: gap.map(toMetric) };
}

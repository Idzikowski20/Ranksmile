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
import { DFS_DEFAULT_KEYWORD_LIMIT, DFS_DEFAULT_RANKED_LIMIT } from '../dataforseoBudget';
import { readLocalSCData } from '../../utils/searchConsole';
import { AiVisibilitySummary } from '../aiSearchScore';
import { CoverageItem, hashId } from '../aiCoverage';
import { normalizePl, tokenize } from '../termMatch';
import { isUsefulTerm, isDictionaryQueryNoise } from '../termUtils';
import { filterOnTopicTerms, isKeywordOnTopic } from '../topicRelevance';
import { throwIfAborted } from '../abortSignal';

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
      key: [opts.seed.toLowerCase(), opts.country || 'US', opts.languageCode || 'en', opts.limit || DFS_DEFAULT_KEYWORD_LIMIT],
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
      key: [opts.seed.toLowerCase(), opts.country || 'US', opts.languageCode || 'en', opts.limit || DFS_DEFAULT_KEYWORD_LIMIT],
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
 * Term ENRICHMENT — only phrase-match suggestions + competitor ranked keywords,
 * strictly filtered to the seed topic. keyword_ideas is excluded (drifts off-topic).
 */
export async function enrichTerms(opts: {
   keyword: string,
   country?: string,
   languageCode?: string,
   ownDomain?: string,
   competitorDomains?: string[],
   limit?: number,
   signal?: AbortSignal,
}): Promise<{ source: KeywordSource, terms: Array<{ term: string, target_count: number }> }> {
   throwIfAborted(opts.signal);
   if (!isDataForSeoConfigured() || !opts.keyword.trim()) { return { source: 'none', terms: [] }; }

   const targetFor = (kw: string) => {
      const wc = kw.trim().split(/\s+/).length;
      if (wc <= 2) return 3;
      if (wc === 3) return 2;
      return 1;
   };

   const own = (opts.ownDomain || '').replace(/^www\./, '').toLowerCase();
   const competitors = (opts.competitorDomains || [])
      .map((d) => d.replace(/^www\./, '').toLowerCase())
      .filter((d) => d && d !== own)
      .slice(0, 3);
   const enrichLimit = 100;

   const rankedFor = (domain: string) => cached({
      namespace: 'ranked',
      key: [domain.toLowerCase(), opts.country || 'US', opts.languageCode || 'en', '15'],
      ttlMs: TTL.RANKED_KEYWORDS,
      producer: () => getRankedKeywords({
         target: domain,
         country: opts.country,
         languageCode: opts.languageCode,
         limit: DFS_DEFAULT_RANKED_LIMIT,
         topOnly: true,
         maxRankGroup: 15,
      }),
   }).then((ks) => ks.map(toMetric)).catch(() => [] as KeywordMetric[]);

   const rankedPromises = [
      ...(own ? [rankedFor(own)] : []),
      ...competitors.map((d) => rankedFor(d)),
   ];

   const [suggestions, ...rankedLists] = await Promise.all([
      getKeywordSuggestions({ seed: opts.keyword, country: opts.country, languageCode: opts.languageCode, limit: enrichLimit })
         .then((r) => r.keywords).catch(() => [] as KeywordMetric[]),
      ...rankedPromises,
   ]);

   throwIfAborted(opts.signal);

   const pool: KeywordMetric[] = [...suggestions, ...rankedLists.flat()];
   const seen = new Set<string>();
   const scored = pool
      .filter((k) => k.keyword && isKeywordOnTopic(k.keyword, opts.keyword))
      .filter((k) => isUsefulTerm(k.keyword.toLowerCase()))
      .filter((k) => { const lk = k.keyword.toLowerCase(); if (seen.has(lk)) return false; seen.add(lk); return true; })
      .sort((a, b) => (b.search_volume || 0) - (a.search_volume || 0))
      .slice(0, opts.limit || 80)
      .map((k) => ({ term: k.keyword.toLowerCase(), target_count: targetFor(k.keyword) }));

   return { source: 'dataforseo', terms: scored };
}

const AI_STOP = new Set(['jak', 'czy', 'co', 'ile', 'gdzie', 'kiedy', 'dlaczego', 'które', 'która', 'który', 'jakie', 'jaki', 'oraz', 'dla', 'the', 'and', 'for', 'what', 'how', 'why', 'where', 'when', 'who', 'does', 'are', 'with']);

function readinessScore(text: string, promptOrFact: string): number {
   const bodyTokens = new Set(tokenize(text));
   const words = tokenize(promptOrFact).filter((w) => w.length >= 4 && !AI_STOP.has(w));
   if (!words.length) return 0;
   const matched = words.filter((w) => bodyTokens.has(w)).length;
   return Math.round((matched / words.length) * 100);
}

function splitFactSentences(answer: string): string[] {
   return (answer || '')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 20 && s.length <= 220);
}

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
      ttlMs: TTL.SERP,
      producer: () => getPeopleAlsoAsk({
         keyword: opts.keyword,
         country: opts.country,
         languageCode: opts.languageCode,
         ownDomain: opts.ownDomain,
      }),
   }).catch(() => ({ questions: [] as Array<{ question: string; answer: string; domain: string; url: string }>, related: [] as string[] }));

   if (!paa.questions.length && !paa.related.length) return null;

   const seed = opts.keyword.trim();
   const onTopicQuestions = paa.questions.filter(
     (q) => q.question && !isDictionaryQueryNoise(q.question) && isKeywordOnTopic(q.question, seed),
   );
   const onTopicRelated = paa.related.filter(
     (r) => r && !isDictionaryQueryNoise(r) && isKeywordOnTopic(r, seed),
   );
   if (!onTopicQuestions.length && !onTopicRelated.length) return null;

   const text = normalizePl(opts.articleText || '');
   const own = (opts.ownDomain || '').replace(/^www\./, '').toLowerCase();

   const citations = [
      ...onTopicQuestions.map((q) => {
         const readiness = readinessScore(text, q.question);
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
      }),
      ...onTopicRelated.map((related) => ({
         prompt: related,
         answer: '',
         cited_url: '',
         cited_domain: '',
         is_own_domain: false,
         is_competitor: false,
         answer_readiness_score: readinessScore(text, related),
      })),
   ];

   const cited = citations.filter((c) => (c.answer_readiness_score ?? 0) >= 60).length;
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

/** Map PAA questions to coverage items with STABLE ids (hash of question text). */
export function paaCoverageItems(questions: Array<{ question: string }>): CoverageItem[] {
  return questions.map((q) => ({
    id: `paa-${hashId(q.question)}`,
    label: q.question,
    type: 'paa' as const,
    category: 'knowledge' as const,
    importance: 'recommended' as const,
    source: 'paa' as const,
    covered: false,
    quality: 0,
  }));
}

/** Surfer-style "Facts to include" — one coverage item per PAA answer sentence. */
export function paaFactsCoverageItems(questions: Array<{ question: string; answer?: string }>): CoverageItem[] {
  const out: CoverageItem[] = [];
  const seen = new Set<string>();
  for (const q of questions) {
    for (const sentence of splitFactSentences(q.answer || '')) {
      const key = sentence.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `fact-${hashId(sentence)}`,
        label: sentence,
        type: 'fact',
        category: 'knowledge',
        importance: 'recommended',
        source: 'paa',
        covered: false,
        quality: 0,
      });
    }
  }
  return out;
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

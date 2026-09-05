/**
 * Keyword expansion + clustering for Keyword Research.
 *
 * Compute only — the queue lives in lib/keywordResearchRunner.ts, which calls
 * computeKeywordResearch and owns the keyword_research_runs table. This file used to
 * carry a second copy of the queue API (enqueueKeywordResearch / processQueuedForDomain)
 * left over from Topic Research: same exported names as the live runner, but writing to
 * the removed topic_research_runs table, so importing from the wrong module would have
 * queued jobs nothing drains.
 */
import { isDataForSeoConfigured, getRankedKeywords } from '@/src/infrastructure/dataforseo/dataforseo';
import { getKeywordIdeas, getKeywordSuggestions } from '@/src/infrastructure/seo/keywordData';
import { langForCountry } from '@/src/core/domain/audit/country';
import {
   assembleResult,
   clusterKeywords,
   type EnrichedKeyword,
} from '@/src/infrastructure/keywords/topicClustering';
import type { KeywordResearchResult, KeywordResearchStats } from '@/src/core/domain/keywords/types';

async function expandKeywords(seed: string, country: string): Promise<EnrichedKeyword[]> {
   if (!isDataForSeoConfigured()) {
      throw new Error('DataForSEO is not configured (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)');
   }
   const lang = langForCountry(country);

   const [suggestions, ideas] = await Promise.all([
      getKeywordSuggestions({ seed, country, languageCode: lang, limit: 200 }),
      getKeywordIdeas({ seed, country, languageCode: lang, limit: 200 }),
   ]);

   const seen = new Map<string, EnrichedKeyword>();
   const add = (k: { keyword: string; search_volume: number | null; keyword_difficulty: number | null }) => {
      const key = k.keyword.toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.set(key, {
         keyword: k.keyword.trim(),
         volume: k.search_volume,
         kd: k.keyword_difficulty,
         position: null,
      });
   };

   for (const k of suggestions.keywords) add(k);
   for (const k of ideas.keywords) add(k);

   // Ensure seed is included
   const seedKey = seed.toLowerCase().trim();
   if (!seen.has(seedKey)) {
      seen.set(seedKey, { keyword: seed.trim(), volume: null, kd: null, position: null });
   }

   return Array.from(seen.values()).sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

async function attachPositions(keywords: EnrichedKeyword[], domainHost: string, country: string): Promise<void> {
   const lang = langForCountry(country);
   const ranked = await getRankedKeywords({
      target: domainHost,
      country,
      languageCode: lang,
      limit: 500,
      maxRankGroup: 50,
   });
   const posMap = new Map<string, number>();
   for (const r of ranked) {
      if (r.position != null && r.position > 0) {
         posMap.set(r.keyword.toLowerCase(), r.position);
      }
   }
   for (const kw of keywords) {
      const p = posMap.get(kw.keyword.toLowerCase());
      if (p != null) kw.position = p;
   }
}

export async function computeKeywordResearch(
   seed: string,
   country: string,
   domainHost: string,
): Promise<{ result: KeywordResearchResult; stats: KeywordResearchStats }> {
   const keywords = await expandKeywords(seed, country);
   if (keywords.length < 3) {
      throw new Error('Not enough keyword ideas returned for this seed. Try a broader topic.');
   }

   await attachPositions(keywords, domainHost, country);

   const rawClusters = await clusterKeywords(seed, keywords);
   const result = assembleResult(seed, country, rawClusters, keywords);
   return { result, stats: result.stats };
}

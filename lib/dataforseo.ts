/**
 * DataForSEO client — the paid reverse-index source in the hybrid keyword stack.
 *
 * Used ONLY for data that free sources (GSC, serper, autocomplete, pytrends)
 * cannot provide:
 *   - keyword ideas WITH absolute search volume + difficulty  (Labs Keyword Ideas)
 *   - competitor ranked keywords / keyword gap                (Labs Ranked Keywords)
 *
 * Credentials come from env (`DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`, Basic
 * auth). When unset, `isDataForSeoConfigured()` is false and callers fall back to
 * the free stack — same graceful-degradation pattern as the serper integration.
 *
 * Requests are NOT cached here; wrap calls in `lib/cache/fileCache.cached()`
 * (the routing layer in `lib/seo/keywordData.ts` does this).
 */
import axios from 'axios';

const BASE = 'https://api.dataforseo.com/v3';

export type DfsKeyword = {
   keyword: string,
   search_volume: number | null,
   cpc: number | null,
   competition: number | null,                  // 0–1 (Google Ads scale)
   competition_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN' | null,
   keyword_difficulty: number | null,           // 0–100
   search_intent: string | null,                // informational | commercial | transactional | navigational
   position: number | null,                      // only set for ranked-keyword results
};

export const isDataForSeoConfigured = (): boolean => (
   !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
);

const authHeader = (): string => {
   const login = process.env.DATAFORSEO_LOGIN || '';
   const password = process.env.DATAFORSEO_PASSWORD || '';
   return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
};

/**
 * Common Google geo-target IDs (DataForSEO reuses Google Ads location codes).
 * The full list comes from the `locations_and_languages` endpoint; this covers
 * the languages serper is already configured for in the sidecar.
 */
const LOCATION_CODES: Record<string, number> = {
   PL: 2616, US: 2840, GB: 2826, DE: 2276, FR: 2250,
   ES: 2724, IT: 2380, NL: 2528, PT: 2620,
};

export const locationCodeFor = (country?: string): number => (
   LOCATION_CODES[(country || 'US').toUpperCase()] ?? 2840
);

type Task = Record<string, unknown>;

/**
 * POST a single task to a DataForSEO `/live` endpoint and return its result
 * items. Throws on API- or task-level error codes (anything but 20000).
 */
async function dfsPost(path: string, task: Task): Promise<any[]> {
   if (!isDataForSeoConfigured()) {
      throw new Error('DataForSEO not configured — set DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.');
   }
   const res = await axios.post(`${BASE}${path}`, [task], {
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      timeout: 60000,
   });

   if (res.data?.status_code !== 20000) {
      throw new Error(`DataForSEO API ${res.data?.status_code}: ${res.data?.status_message}`);
   }
   const taskData = res.data?.tasks?.[0];
   if (taskData?.status_code !== 20000) {
      throw new Error(`DataForSEO task ${taskData?.status_code}: ${taskData?.status_message}`);
   }
   return taskData?.result?.[0]?.items ?? [];
}

/** Normalises both the flat (keyword_ideas) and nested (ranked_keywords) item shapes. */
const mapItem = (item: any): DfsKeyword => {
   const info = item?.keyword_info ?? item?.keyword_data?.keyword_info ?? {};
   const props = item?.keyword_properties ?? item?.keyword_data?.keyword_properties ?? {};
   const rank = item?.ranked_serp_element?.serp_item?.rank_absolute ?? null;
   return {
      keyword: item?.keyword ?? item?.keyword_data?.keyword ?? '',
      search_volume: typeof info?.search_volume === 'number' ? info.search_volume : null,
      cpc: typeof info?.cpc === 'number' ? info.cpc : null,
      competition: typeof info?.competition === 'number' ? info.competition : null,
      competition_level: info?.competition_level ?? null,
      keyword_difficulty: typeof props?.keyword_difficulty === 'number' ? props.keyword_difficulty : null,
      search_intent: item?.search_intent_info?.main_intent ?? item?.keyword_data?.search_intent_info?.main_intent ?? props?.search_intent ?? null,
      position: typeof rank === 'number' ? rank : null,
   };
};

/** Keyword Ideas — seed keyword(s) → relevant ideas with volume + difficulty + cpc. */
export async function getKeywordIdeas(opts: {
   keywords: string[],
   country?: string,
   languageCode?: string,
   limit?: number,
}): Promise<DfsKeyword[]> {
   const items = await dfsPost('/dataforseo_labs/google/keyword_ideas/live', {
      keywords: opts.keywords.slice(0, 200).map((k) => k.toLowerCase()),
      location_code: locationCodeFor(opts.country),
      language_code: opts.languageCode || 'en',
      limit: Math.min(opts.limit || 700, 1000),
   });
   return items.map(mapItem).filter((k) => k.keyword);
}

/** Keyword Suggestions — full-phrase ("long-tail") expansions of a single seed. */
export async function getKeywordSuggestions(opts: {
   keyword: string,
   country?: string,
   languageCode?: string,
   limit?: number,
}): Promise<DfsKeyword[]> {
   const items = await dfsPost('/dataforseo_labs/google/keyword_suggestions/live', {
      keyword: opts.keyword.toLowerCase(),
      location_code: locationCodeFor(opts.country),
      language_code: opts.languageCode || 'en',
      limit: Math.min(opts.limit || 700, 1000),
   });
   return items.map(mapItem).filter((k) => k.keyword);
}

export type PaaQuestion = { question: string, answer: string, domain: string, url: string };

/**
 * People Also Ask + related searches for a keyword — the real questions Google
 * (and the LLMs that read it) answer. Used to build the AI Search "info to cover"
 * list. One SERP request (~$0.002), expanded one click-depth for more questions.
 */
export async function getPeopleAlsoAsk(opts: {
   keyword: string,
   country?: string,
   languageCode?: string,
}): Promise<{ questions: PaaQuestion[], related: string[] }> {
   const items = await dfsPost('/serp/google/organic/live/advanced', {
      keyword: opts.keyword,
      location_code: locationCodeFor(opts.country),
      language_code: opts.languageCode || 'en',
      depth: 20,
      people_also_ask_click_depth: 2,
   });
   const questions: PaaQuestion[] = [];
   const related: string[] = [];
   for (const item of items) {
      if (item?.type === 'people_also_ask' && Array.isArray(item.items)) {
         for (const q of item.items) {
            const exp = Array.isArray(q?.expanded_element) ? q.expanded_element[0] : null;
            if (q?.title) {
               questions.push({
                  question: q.title,
                  answer: exp?.description || '',
                  domain: exp?.domain || '',
                  url: exp?.url || '',
               });
            }
         }
      } else if (item?.type === 'related_searches' && Array.isArray(item.items)) {
         related.push(...item.items.filter((s: any) => typeof s === 'string'));
      }
   }
   return { questions, related };
}

/** Ranked Keywords — every keyword a domain ranks for (reverse index). */
export async function getRankedKeywords(opts: {
   target: string,
   country?: string,
   languageCode?: string,
   limit?: number,
   topOnly?: boolean, // restrict to top-10 positions
}): Promise<DfsKeyword[]> {
   const task: Task = {
      target: opts.target.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      location_code: locationCodeFor(opts.country),
      language_code: opts.languageCode || 'en',
      limit: Math.min(opts.limit || 100, 1000),
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
   };
   if (opts.topOnly) {
      task.filters = [['ranked_serp_element.serp_item.rank_group', '<=', 10]];
   }
   const items = await dfsPost('/dataforseo_labs/google/ranked_keywords/live', task);
   return items.map(mapItem).filter((k) => k.keyword);
}

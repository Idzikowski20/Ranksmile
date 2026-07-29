// GET /api/articles/keyword-suggest?q=...&country=US
import type { NextApiRequest, NextApiResponse } from 'next';
import verifyUser from '../../../utils/verifyUser';
import { getAdwordsCredentials, getAdwordsKeywordIdeas } from '../../../utils/adwords';
import { getKeywordSuggestions as getDfsKeywordSuggestions } from '../../../lib/seo/keywordData';
import { withOrgPaymentAccess } from '../../../lib/requireOrgPaymentAccess';

type Suggestion = {
   keyword: string;
   volume?: number;
   competitionIndex?: number; // 0–100, drives the difficulty bars in the UI
   intent?: string;           // informational | commercial | transactional | navigational
   cpc?: number;
};

/** Map an ISO country to the DataForSEO search language. */
const langForCountry = (c: string): string => {
   const map: Record<string, string> = { PL: 'pl', DE: 'de', FR: 'fr', ES: 'es', IT: 'it', NL: 'nl', PT: 'pt' };
   return map[c.toUpperCase()] || 'en';
};

type Response = {
   suggestions: Suggestion[];
   hasVolumeData: boolean;
} | { error: string };

async function handler(req: NextApiRequest, res: NextApiResponse<Response>) {
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') {
      return res.status(401).json({ error: authorized });
   }

   if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

   const { q, country = 'US' } = req.query;
   if (!q || typeof q !== 'string' || q.trim().length < 3) {
      return res.status(400).json({ error: 'q must be at least 3 characters' });
   }

   // Try Google Ads first
   try {
      const creds = await getAdwordsCredentials();
      if (creds) {
         const ideas = await getAdwordsKeywordIdeas(creds, {
            country: typeof country === 'string' ? country : 'US',
            language: '1000',
            keywords: [q.trim()],
            seedType: 'custom',
         });
         if (ideas && Array.isArray(ideas) && ideas.length > 0) {
            const suggestions: Suggestion[] = ideas.slice(0, 10).map((idea) => ({
               keyword: idea.keyword,
               volume: idea.avgMonthlySearches,
               competitionIndex: idea.competitionIndex,
            }));
            return res.status(200).json({ suggestions, hasVolumeData: true });
         }
      }
   } catch {
      // fall through to DataForSEO
   }

   // DataForSEO (paid, cached 30d) — volume + difficulty for the typed phrase and
   // its keyword family. No-ops to empty when DATAFORSEO_* env is unset.
   try {
      const c = typeof country === 'string' ? country : 'US';
      const { keywords } = await getDfsKeywordSuggestions({
         seed: q.trim(),
         country: c,
         languageCode: langForCountry(c),
         limit: 10,
      });
      if (keywords.length > 0) {
         const suggestions: Suggestion[] = keywords.slice(0, 10).map((k) => ({
            keyword: k.keyword,
            volume: k.search_volume ?? undefined,
            competitionIndex: k.keyword_difficulty ?? undefined,
            intent: k.search_intent ?? undefined,
            cpc: k.cpc ?? undefined,
         }));
         return res.status(200).json({ suggestions, hasVolumeData: true });
      }
   } catch {
      // fall through to Google Suggest
   }

   // Fallback: Google Suggest (free, no auth needed)
   try {
      const langCode = typeof country === 'string' ? country.toLowerCase() : 'en';
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q.trim())}&hl=${langCode}&ie=utf-8&oe=utf-8`;
      const fetchRes = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (fetchRes.ok) {
         // Explicitly decode as UTF-8 to handle Polish / non-ASCII characters correctly
         const buf = await fetchRes.arrayBuffer();
         const text = new TextDecoder('utf-8').decode(buf);
         const data = JSON.parse(text);
         const rawSuggestions: string[] = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
         const suggestions: Suggestion[] = rawSuggestions.slice(0, 10).map((kw: string) => ({ keyword: kw }));
         return res.status(200).json({ suggestions, hasVolumeData: false });
      }
   } catch {
      // network offline or timeout
   }

   return res.status(200).json({ suggestions: [], hasVolumeData: false });
}

export default withOrgPaymentAccess(handler);

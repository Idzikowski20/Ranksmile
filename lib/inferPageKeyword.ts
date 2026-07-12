import { normalizeUrlForMatch } from '../utils/gsc';
import { tokenize } from './termMatch';

function bestTokenOverlap(query: string, candidates: string[], fallback: string): string {
  const queryTokens = new Set(tokenize(query.toLowerCase()));
  let best = fallback;
  let bestOverlap = -1;
  for (const kw of candidates) {
    const overlap = tokenize(kw.toLowerCase()).filter((t) => queryTokens.has(t)).length;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = kw;
    }
  }
  return bestOverlap > 0 ? best : fallback;
}

const PL_DIACRITICS = /[ąćęłńóśźż]/i;
export const langFromKeyword = (kw: string): string => (PL_DIACRITICS.test(kw) ? 'pl' : 'en');

/** Slug segment → readable keyword candidate (e.g. /jak-sprawdzic-czy-…/ → words). */
export function keywordFromUrl(url: string): string {
   try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      const slug = parts[parts.length - 1] || '';
      if (!slug || slug.includes('.') || slug.length < 6) return '';
      return slug.replace(/-/g, ' ').trim();
   } catch {
      return '';
   }
}

/**
 * Pick the target query for Surfer-style scoring: GSC page→query, then URL slug,
 * then best overlap with domain seed keywords.
 */
export function inferPageKeyword(
   url: string,
   title: string,
   domainKeywords: string[],
   gscByUrl: Map<string, string>,
): string {
   const fromGsc = gscByUrl.get(normalizeUrlForMatch(url));
   if (fromGsc) return fromGsc;

   const slugKw = keywordFromUrl(url);
   if (slugKw) {
      const hit = domainKeywords.find((k) => k.toLowerCase() === slugKw.toLowerCase());
      if (hit) return hit;
   }

   const hay = `${title} ${slugKw}`.toLowerCase();
   const overlapBest = bestTokenOverlap(hay, domainKeywords, '');
   if (overlapBest) return overlapBest;

   if (slugKw) return slugKw;

   const shortTitle = title.split(' | ')[0]?.trim();
   return domainKeywords[0] || shortTitle || 'seo';
}

/** Map a page keyword to a cached benchmark key (max distinct SERP fetches). */
export function pickBenchmarkKeyword(
   pageKeyword: string,
   cachedKeywords: string[],
   fallback: string,
): string {
   if (cachedKeywords.includes(pageKeyword)) return pageKeyword;
   if (cachedKeywords.length === 0) return pageKeyword;
   return bestTokenOverlap(pageKeyword, cachedKeywords, cachedKeywords[0] || fallback);
}

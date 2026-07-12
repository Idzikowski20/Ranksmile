import { keywordFromUrl } from './inferPageKeyword';
import { factReadinessScore } from './factReadiness';
import { seedTokens } from './topicRelevance';

/**
 * Keyword for facts / PAA / citations — must align with article body, not domain-wide GSC noise.
 */
export function resolveFactKeyword(opts: {
  keyword: string;
  articleText: string;
  title?: string;
  pageUrl?: string;
}): string {
  const articleText = opts.articleText || '';
  const titleBase = (opts.title || '').split(' | ')[0]?.trim() || '';
  const slugKw = opts.pageUrl ? keywordFromUrl(opts.pageUrl) : '';

  const scoreCandidate = (kw: string): number => {
    const t = kw.trim();
    if (!t || t.length < 4) return -1;
    const low = t.toLowerCase();
    const body = articleText.toLowerCase();

    if (/\b(co to znaczy|co znaczy)\b/i.test(t)) {
      const head = low.replace(/\s*(co to znaczy|co znaczy)\s*/g, ' ').trim().split(/\s+/)[0] || '';
      if (head && !body.includes(head)) return -1;
    }

    const seeds = seedTokens(t);
    if (!seeds.length) return 0;
    const seedHit = seeds.filter((s) => body.includes(s)).length / seeds.length;
    if (seedHit < 0.34) return Math.round(seedHit * 30);
    return Math.round(seedHit * 70 + factReadinessScore(articleText, t) * 0.3);
  };

  const candidates = [opts.keyword, slugKw, titleBase].filter((k) => k?.trim());
  let best = candidates[0]?.trim() || '';
  let bestScore = scoreCandidate(best);
  for (const c of candidates.slice(1)) {
    const s = scoreCandidate(c);
    if (s > bestScore) {
      bestScore = s;
      best = c.trim();
    }
  }
  return best || opts.keyword.trim() || slugKw || titleBase;
}

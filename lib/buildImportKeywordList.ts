/**
 * Client-safe keyword list builder for import / deep-analysis entry points.
 * Keep free of DB, GSC API, DataForSEO — safe to import from pages/.
 */
import { normalizeUrlForMatch, kwScore, type GscKeywordRow } from '../utils/gsc';
import { inferPageKeyword, keywordFromUrl, urlAnchorSeed } from './inferPageKeyword';
import { isDictionaryQueryNoise } from './termUtils';
import { isKeywordOnTopic } from './topicRelevance';

export type { GscKeywordRow };

/** GSC page queries + user seed for import / deep-analysis. */
export function buildImportKeywordList(opts: {
  pageUrl: string;
  title?: string;
  userKeywords?: string[];
  gscRows?: GscKeywordRow[];
  max?: number;
}): { primaryKeyword: string; keywords: string[] } {
  const max = opts.max ?? 20;
  const pageNorm = opts.pageUrl ? normalizeUrlForMatch(opts.pageUrl) : '';
  const pageHits = (opts.gscRows || []).filter(
    (r) => r.keyword && (!pageNorm || !r.page || normalizeUrlForMatch(r.page) === pageNorm),
  );
  const anchor = opts.userKeywords?.[0]?.trim() || urlAnchorSeed(opts.pageUrl) || '';
  const scored = pageHits
    .filter((r) => {
      const kw = r.keyword.trim();
      if (isDictionaryQueryNoise(kw)) return false;
      if (!anchor) return false;
      return isKeywordOnTopic(kw, anchor);
    })
    .map((r) => ({
      keyword: r.keyword.trim(),
      score: kwScore(r),
    }));
  scored.sort((a, b) => b.score - a.score);
  const gscKws = [...new Set(scored.map((s) => s.keyword))];

  const gscByUrl = new Map<string, string>();
  if (pageNorm && gscKws[0]) gscByUrl.set(pageNorm, gscKws[0]);

  const primaryKeyword = opts.userKeywords?.[0]?.trim()
    || urlAnchorSeed(opts.pageUrl)
    || (() => {
      const inferred = inferPageKeyword(opts.pageUrl, opts.title || '', gscKws, gscByUrl);
      if (inferred && anchor && isKeywordOnTopic(inferred, anchor)) return inferred;
      return '';
    })()
    || keywordFromUrl(opts.pageUrl)
    || gscKws[0]
    || '';

  const seen = new Set<string>();
  const keywords: string[] = [];
  const push = (kw: string | undefined) => {
    const t = (kw || '').trim();
    if (!t) return;
    const lk = t.toLowerCase();
    if (seen.has(lk)) return;
    seen.add(lk);
    keywords.push(t);
  };

  push(primaryKeyword);
  for (const k of opts.userKeywords || []) push(k);
  for (const k of gscKws) push(k);

  return { primaryKeyword, keywords: keywords.slice(0, max) };
}

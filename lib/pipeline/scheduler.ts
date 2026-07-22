/**
 * Thin corpus refresh scheduler — expires_at + SERP-changed trigger.
 */
import {
  getFreshCorpus,
  getLatestCorpusVersions,
  serpChangeRatio,
  shouldForceRefresh,
  type VolatilityClass,
} from '../corpus/corpusService';

export type RefreshDecision = {
  shouldRefresh: boolean;
  reason: 'expired' | 'serp_changed' | 'fresh' | 'missing';
  changeRatio?: number;
  corpusId?: string;
};

/**
 * Decide whether analyze should refresh corpus.
 * If nextUrls provided and ≥30% SERP change vs last corpus → force refresh.
 */
export async function decideCorpusRefresh(opts: {
  workspaceId: string;
  keyword: string;
  language?: string;
  nextUrls?: string[];
  changeThreshold?: number;
}): Promise<RefreshDecision> {
  const fresh = await getFreshCorpus({
    workspaceId: opts.workspaceId,
    keyword: opts.keyword,
    language: opts.language,
  });

  if (!fresh) {
    return { shouldRefresh: true, reason: 'missing' };
  }

  if (opts.nextUrls?.length) {
    const versions = await getLatestCorpusVersions({
      workspaceId: opts.workspaceId,
      keyword: opts.keyword,
      language: opts.language,
      limit: 1,
    });
    const prev = versions[0];
    if (prev) {
      const ratio = serpChangeRatio(prev.urls, opts.nextUrls);
      if (shouldForceRefresh(ratio, opts.changeThreshold ?? 0.3)) {
        return {
          shouldRefresh: true,
          reason: 'serp_changed',
          changeRatio: ratio,
          corpusId: prev.id,
        };
      }
    }
  }

  return {
    shouldRefresh: false,
    reason: 'fresh',
    corpusId: fresh.id,
  };
}

export function volatilityFromKeywordHints(keyword: string): VolatilityClass {
  const k = keyword.toLowerCase();
  if (/\b(news|cena|kurs|bitcoin|wybory)\b/.test(k)) return 'high';
  if (/\b(202\d|trend)\b/.test(k)) return 'medium';
  if (/\b(definicja|co to jest|historia)\b/.test(k)) return 'stable';
  return 'medium';
}

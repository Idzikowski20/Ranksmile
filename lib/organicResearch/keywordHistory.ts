import { cached, TTL } from '../cache/fileCache';
import { getDomainLocale } from '../domainLanguage';
import Domain from '../../database/models/domain';
import {
  fetchKeywordPositionHistory,
  type KeywordPositionPoint,
} from '../../providers/dataforseo/historicalSerps';
import { isDataForSeoConfigured } from '../../providers/dataforseo/client';
import { synthesizePositionHistory } from './synthesizePositionHistory';

export type { KeywordPositionPoint };
export { synthesizePositionHistory };

export async function loadOrganicKeywordPositionHistory(opts: {
  domainId: number;
  keyword: string;
  position?: number | null;
  previousPosition?: number | null;
  change30d?: number | null;
  updatedAt?: string | null;
}): Promise<{ points: KeywordPositionPoint[]; source: 'dataforseo' | 'synthetic' | 'empty' }> {
  const domain = await Domain.findByPk(opts.domainId);
  if (!domain) return { points: [], source: 'empty' };
  const hostname = String(domain.domain || '');
  const locale = await getDomainLocale(opts.domainId);
  const keyword = opts.keyword.trim().toLowerCase();

  if (isDataForSeoConfigured() && keyword) {
    try {
      const points = await cached({
        namespace: 'organic-keyword-history',
        key: [
          hostname,
          locale.countryCode,
          locale.languageCode,
          keyword,
        ],
        ttlMs: TTL.RANKED_KEYWORDS,
        producer: () => fetchKeywordPositionHistory({
          keyword: opts.keyword.trim(),
          target: hostname,
          country: locale.countryCode || undefined,
          languageCode: locale.languageCode || undefined,
        }),
      });
      if (points.some((p) => p.position != null)) {
        return { points, source: 'dataforseo' };
      }
    } catch {
      /* fall through to synthetic */
    }
  }

  const synthetic = synthesizePositionHistory({
    position: opts.position ?? null,
    previousPosition: opts.previousPosition ?? null,
    change30d: opts.change30d ?? null,
    updatedAt: opts.updatedAt,
  });
  return {
    points: synthetic,
    source: synthetic.length ? 'synthetic' : 'empty',
  };
}

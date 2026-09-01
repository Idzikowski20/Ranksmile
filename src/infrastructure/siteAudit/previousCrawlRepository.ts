import type { IPreviousCrawlRepository } from '../../core/domain/siteAudit/previousCrawlRepository';
import type { PreviousCrawlMetrics } from '../../core/domain/siteAudit/crawlDeltas';
import { getPreviousCrawlMetrics } from '@/src/infrastructure/siteAudit/crawlSnapshot';

/**
 * DB-backed IPreviousCrawlRepository. Maps the (wider) crawl-snapshot metrics
 * down to the domain PreviousCrawlMetrics shape.
 */
export function createPreviousCrawlRepository(): IPreviousCrawlRepository {
  return {
    async getPreviousCrawlMetrics(domainId): Promise<PreviousCrawlMetrics | null> {
      const m = await getPreviousCrawlMetrics(domainId);
      if (!m) return null;
      return {
        siteHealth: m.siteHealth,
        pagesCrawled: m.pagesCrawled,
        totalErrors: m.totalErrors,
        totalWarnings: m.totalWarnings,
      };
    },
  };
}

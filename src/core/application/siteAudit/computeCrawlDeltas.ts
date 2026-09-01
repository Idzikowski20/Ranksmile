import { crawlVsPreviousDeltas, type CrawlVsPreviousDeltas } from '../../domain/siteAudit/crawlDeltas';
import type { IPreviousCrawlRepository } from '../../domain/siteAudit/previousCrawlRepository';

export type LiveCrawlOverview = {
  siteHealth: number;
  pagesCrawled: number;
  errors: number;
  warnings: number;
};

/**
 * Use-case: fetch the previous crawl's metrics and diff the live overview against
 * them. Absorbs the getPreviousCrawlMetrics + crawlVsPreviousDeltas pair from
 * lib/siteAudit/buildOverview.ts.
 */
export async function computeCrawlDeltas(
  repo: IPreviousCrawlRepository,
  domainId: number,
  live: LiveCrawlOverview,
): Promise<CrawlVsPreviousDeltas> {
  const previous = await repo.getPreviousCrawlMetrics(domainId);
  return crawlVsPreviousDeltas(live, previous);
}

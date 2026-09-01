import type { PreviousCrawlMetrics } from './crawlDeltas';

/**
 * Port for reading the previous crawl's summary metrics for a domain. The
 * DB-backed implementation lives in
 * src/infrastructure/siteAudit/previousCrawlRepository.ts.
 */
export interface IPreviousCrawlRepository {
  getPreviousCrawlMetrics(domainId: number): Promise<PreviousCrawlMetrics | null>;
}

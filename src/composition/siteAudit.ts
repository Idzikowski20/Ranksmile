import {
  computeCrawlDeltas as runUseCase,
  type LiveCrawlOverview,
} from '../core/application/siteAudit/computeCrawlDeltas';
import type { CrawlVsPreviousDeltas } from '../core/domain/siteAudit/crawlDeltas';
import { createPreviousCrawlRepository } from '../infrastructure/siteAudit/previousCrawlRepository';

/** Composition root for site-audit — wires the previous-crawl repository into the use-case. */
export function computeCrawlDeltas(
  domainId: number,
  live: LiveCrawlOverview,
): Promise<CrawlVsPreviousDeltas> {
  return runUseCase(createPreviousCrawlRepository(), domainId, live);
}

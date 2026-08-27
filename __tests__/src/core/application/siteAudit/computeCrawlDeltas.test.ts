import { computeCrawlDeltas } from '../../../../../src/core/application/siteAudit/computeCrawlDeltas';
import type { IPreviousCrawlRepository } from '../../../../../src/core/domain/siteAudit/previousCrawlRepository';

const live = { siteHealth: 80, pagesCrawled: 120, errors: 5, warnings: 10 };

describe('computeCrawlDeltas use-case', () => {
  it('diffs the live overview against the previous crawl', async () => {
    const repo: IPreviousCrawlRepository = {
      getPreviousCrawlMetrics: async () => ({ siteHealth: 70, pagesCrawled: 100, totalErrors: 8, totalWarnings: 4 }),
    };
    expect(await computeCrawlDeltas(repo, 1, live)).toEqual({
      siteHealthDelta: 10,
      pagesDelta: 20,
      errorsDelta: -3,
      warningsDelta: 6,
    });
  });

  it('returns null deltas when there is no previous crawl', async () => {
    const repo: IPreviousCrawlRepository = { getPreviousCrawlMetrics: async () => null };
    expect(await computeCrawlDeltas(repo, 1, live)).toEqual({
      siteHealthDelta: null,
      pagesDelta: null,
      errorsDelta: null,
      warningsDelta: null,
    });
  });
});

import { crawlVsPreviousDeltas } from '../../../lib/siteAudit/crawlDeltas';

describe('crawlVsPreviousDeltas', () => {
  const prev = {
    pagesCrawled: 100,
    siteHealth: 70,
    totalErrors: 10,
    totalWarnings: 20,
  };

  it('returns nulls when no previous snapshot', () => {
    expect(crawlVsPreviousDeltas(
      { siteHealth: 80, pagesCrawled: 110, errors: 5, warnings: 15 },
      null,
    )).toEqual({
      siteHealthDelta: null,
      pagesDelta: null,
      errorsDelta: null,
      warningsDelta: null,
    });
  });

  it('subtracts previous snapshot from live metrics', () => {
    expect(crawlVsPreviousDeltas(
      { siteHealth: 82, pagesCrawled: 120, errors: 7, warnings: 18 },
      prev,
    )).toEqual({
      siteHealthDelta: 12,
      pagesDelta: 20,
      errorsDelta: -3,
      warningsDelta: -2,
    });
  });
});

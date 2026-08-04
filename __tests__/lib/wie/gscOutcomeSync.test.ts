import { aggregateGscPageMetrics } from '../../../lib/wie/gscPageMetrics';

describe('WIE gscOutcomeSync', () => {
  it('aggregates exact pathname matches across keyword rows', () => {
    const page = aggregateGscPageMetrics(
      [
        {
          page: 'https://example.com/szantaz-co-robic/',
          clicks: 5,
          impressions: 100,
          position: 8,
          ctr: 0.05,
        },
        {
          page: 'https://example.com/szantaz-co-robic',
          clicks: 3,
          impressions: 50,
          position: 10,
          ctr: 0.06,
        },
        {
          page: 'https://example.com/other',
          clicks: 99,
          impressions: 999,
          position: 1,
          ctr: 0.1,
        },
      ],
      'https://example.com/szantaz-co-robic/',
    );

    expect(page).not.toBeNull();
    expect(page!.clicks).toBe(8);
    expect(page!.impressions).toBe(150);
    expect(page!.rowsMatched).toBe(2);
    // impression-weighted position: (8*100 + 10*50) / 150 = 8.666…
    expect(page!.position).toBeCloseTo(8.666, 2);
    expect(page!.ctr).toBeCloseTo(8 / 150, 5);
  });

  it('returns null when page not in GSC rows', () => {
    const page = aggregateGscPageMetrics(
      [{ page: 'https://example.com/a', clicks: 1, impressions: 10, position: 5 }],
      'https://example.com/missing',
    );
    expect(page).toBeNull();
  });
});

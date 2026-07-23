import {
  filterKeywords,
  sortKeywords,
} from '../../../lib/organicResearch/filter';
import {
  opportunityScore,
  mapKeywords,
  expandMonthlyChartToDaily,
} from '../../../lib/organicResearch/derive';
import type { ChartPoint, ProviderKeywordRow } from '../../../lib/organicResearch/types';

describe('organicResearch derive + filter', () => {
  const rows: ProviderKeywordRow[] = [
    {
      keyword: 'agencja seo',
      intent: 'commercial',
      position: 5,
      previousPosition: 12,
      volume: 1000,
      difficulty: 40,
      cpc: 2,
      traffic: 50,
      trafficCost: 100,
      serpFeatures: ['images'],
      itemType: 'organic',
      url: 'https://example.com/seo',
      updatedAt: '2026-07-01 00:00:00 +00:00',
    },
    {
      keyword: 'co to jest seo',
      intent: 'informational',
      position: 15,
      previousPosition: 8,
      volume: 500,
      difficulty: 20,
      cpc: 0.5,
      traffic: 10,
      trafficCost: 5,
      serpFeatures: [],
      itemType: 'organic',
      url: 'https://example.com/blog',
      updatedAt: null,
    },
  ];

  it('maps keywords with state, trend, opportunity, pages', () => {
    const mapped = mapKeywords('example.com', 'PL:pl', rows);
    expect(mapped).toHaveLength(2);
    expect(mapped[0].state).toBe('growing');
    expect(mapped[0].trend).toBe('up');
    expect(mapped[0].change30d).toBe(7);
    expect(mapped[1].state).toBe('declining');
    expect(mapped[0].opportunityScore).not.toBeNull();
    expect(mapped[0].topicId).toBe('uncategorized');
    expect(mapped[0].entityIds).toEqual([]);
  });

  it('filters by tab, intent and positions', () => {
    const mapped = mapKeywords('example.com', 'PL:pl', rows);
    const top10 = filterKeywords(mapped, { positionMin: 4, positionMax: 10 });
    expect(top10).toHaveLength(1);
    expect(top10[0].keyword).toBe('agencja seo');

    const info = filterKeywords(mapped, { intents: ['informational'] });
    expect(info).toHaveLength(1);
    expect(info[0].keyword).toBe('co to jest seo');
  });

  it('sorts by opportunity', () => {
    const mapped = mapKeywords('example.com', 'PL:pl', rows);
    const sorted = sortKeywords(mapped, 'opportunityScore', 'desc');
    expect(sorted[0].opportunityScore! >= sorted[1].opportunityScore!).toBe(true);
  });

  it('computes opportunity score deterministically', () => {
    const a = opportunityScore({ volume: 1000, difficulty: 40, position: 5 });
    const b = opportunityScore({ volume: 1000, difficulty: 40, position: 5 });
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });

  it('expands monthly Labs snapshots to daily bars', () => {
    const monthly: ChartPoint[] = [
      {
        date: '2026-06-01',
        top3: 10,
        pos4_10: 20,
        pos11_20: 30,
        pos21_50: 40,
        pos51_100: 50,
        serpFeatures: 0,
        keywordCount: 150,
        traffic: 1000,
      },
      {
        date: '2026-07-01',
        top3: 12,
        pos4_10: 22,
        pos11_20: 32,
        pos21_50: 42,
        pos51_100: 52,
        serpFeatures: 1,
        keywordCount: 160,
        traffic: 1100,
      },
    ];
    const daily = expandMonthlyChartToDaily(monthly, '2026-07-05');
    expect(daily[0].date).toBe('2026-06-01');
    expect(daily.find((p) => p.date === '2026-06-30')?.top3).toBe(10);
    expect(daily.find((p) => p.date === '2026-07-01')?.top3).toBe(12);
    expect(daily.find((p) => p.date === '2026-07-05')?.keywordCount).toBe(160);
    expect(daily).toHaveLength(35);
  });
});

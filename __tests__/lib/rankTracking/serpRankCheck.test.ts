import { buildRankCheckResult } from '../../../lib/rankTracking/serpRankCheck';
import { estimateRankCheckCostUsd } from '../../../lib/rankTracking/cost';
import { exportRankRows } from '../../../lib/rankTracking/exporter';
import type { RankTrackingRow } from '../../../lib/types/rankTracking';

describe('buildRankCheckResult', () => {
  it('marks found when organic domain matches target', () => {
    const result = buildRankCheckResult(
      { keywordId: '1', keyword: 'seo', targetDomain: 'example.com' },
      [
        { type: 'organic', domain: 'other.com', rank_absolute: 1, url: 'https://other.com' },
        { type: 'organic', domain: 'www.example.com', rank_absolute: 5, url: 'https://example.com/page', title: 'Page' },
      ],
    );
    expect(result.found).toBe(true);
    expect(result.position).toBe(5);
    expect(result.url).toBe('https://example.com/page');
  });

  it('returns not found when target missing within depth', () => {
    const result = buildRankCheckResult(
      { keywordId: '2', keyword: 'seo', targetDomain: 'example.com' },
      [{ type: 'organic', domain: 'other.com', rank_absolute: 1 }],
    );
    expect(result.found).toBe(false);
    expect(result.position).toBeNull();
  });

  it('stores only items array semantics in rawItems', () => {
    const items = [{ type: 'organic', domain: 'a.com', rank_absolute: 1 }];
    const result = buildRankCheckResult(
      { keywordId: '3', keyword: 'x', targetDomain: 'a.com' },
      items,
    );
    expect(result.rawItems).toEqual(items);
    expect(result.rawItems).not.toHaveProperty('tasks');
  });
});

describe('estimateRankCheckCostUsd', () => {
  it('scales with keyword count and devices', () => {
    const one = estimateRankCheckCostUsd(10, 'desktop', 40, 'live');
    const both = estimateRankCheckCostUsd(10, 'both', 40, 'live');
    expect(both).toBeGreaterThan(one);
  });
});

describe('exportRankRows', () => {
  const row: RankTrackingRow = {
    trackingKeywordId: 1,
    keyword: 'test',
    searchVolume: 100,
    keywordDifficulty: 20,
    cpc: 1.5,
    desktop: {
      position: 3,
      previousPosition: 5,
      rankingUrl: 'https://example.com',
      rankingTitle: 'Title',
      found: true,
      serpFeatures: ['paa'],
    },
    mobile: {
      position: null,
      previousPosition: null,
      rankingUrl: null,
      rankingTitle: null,
      found: false,
      serpFeatures: [],
    },
  };

  it('exports CSV with headers', () => {
    const csv = exportRankRows([row], 'csv', ['desktop']);
    expect(csv).toContain('keyword,device,position');
    expect(csv).toContain('test,desktop,3');
  });

  it('exports JSON array', () => {
    const json = exportRankRows([row], 'json', ['desktop']);
    const parsed = JSON.parse(json) as Array<{ keyword: string }>;
    expect(parsed[0].keyword).toBe('test');
  });
});

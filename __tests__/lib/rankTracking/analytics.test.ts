import { buildAnalyticsSummary } from '../../../lib/rankTracking/analytics';
import type { RankTrackingConfigRow, RankTrackingRow } from '../../../lib/types/rankTracking';

jest.mock('../../../lib/rankTracking/results', () => ({
  buildRankResultsPage: jest.fn(),
}));

import { buildRankResultsPage } from '../../../lib/rankTracking/results';

const config = {
  id: 1,
  domain_id: 1,
  devices: 'desktop',
  location_code: 2840,
  language_code: 'en',
} as RankTrackingConfigRow;

const mockRows: RankTrackingRow[] = [
  {
    trackingKeywordId: 1,
    keyword: 'gainer',
    searchVolume: 100,
    keywordDifficulty: 10,
    cpc: 1,
    desktop: { position: 3, previousPosition: 10, rankingUrl: null, rankingTitle: null, found: true, serpFeatures: [] },
    mobile: { position: null, previousPosition: null, rankingUrl: null, rankingTitle: null, found: false, serpFeatures: [] },
  },
  {
    trackingKeywordId: 2,
    keyword: 'loser',
    searchVolume: 50,
    keywordDifficulty: 20,
    cpc: 2,
    desktop: { position: 15, previousPosition: 5, rankingUrl: null, rankingTitle: null, found: true, serpFeatures: [] },
    mobile: { position: null, previousPosition: null, rankingUrl: null, rankingTitle: null, found: false, serpFeatures: [] },
  },
];

describe('buildAnalyticsSummary', () => {
  beforeEach(() => {
    (buildRankResultsPage as jest.Mock).mockResolvedValue({ rows: mockRows, total: 2 });
  });

  it('computes top gainers and losers', async () => {
    const summary = await buildAnalyticsSummary(config, '7d');
    expect(summary.topGainers[0]?.keyword).toBe('gainer');
    expect(summary.topGainers[0]?.delta).toBe(7);
    expect(summary.topLosers[0]?.keyword).toBe('loser');
    expect(summary.topLosers[0]?.delta).toBe(-10);
  });

  it('computes visibility score buckets', async () => {
    const summary = await buildAnalyticsSummary(config, '7d');
    expect(summary.visibilityScore.top3).toBeGreaterThanOrEqual(0);
    expect(summary.averagePosition).not.toBeNull();
  });
});

import { getOptimizeRecommendations } from './getOptimizeRecommendations';
import type { ISnapshotRepository } from '../../domain/gsc/snapshotRepository';
import type { SnapMap } from '../../domain/gsc/drops';
import { weekStartFor, shiftWeek } from '../../domain/gsc/week';

const NOW = new Date('2026-08-31T00:00:00Z');
const thisWeek = weekStartFor(NOW);
const lastWeek = shiftWeek(thisWeek, -1);

function repoOf(current: SnapMap, previous: SnapMap): ISnapshotRepository {
  return {
    getSnapshot: (_domainId, weekStart) =>
      Promise.resolve(weekStart === thisWeek ? current : weekStart === lastWeek ? previous : new Map()),
  };
}

describe('getOptimizeRecommendations', () => {
  it('ranks striking-distance pages above already-top pages and drops zero-impression pages', async () => {
    const current: SnapMap = new Map([
      ['/page-2-keyword/', { clicks: 40, impressions: 5000, position: 18 }], // prime opportunity
      ['/already-ranking/', { clicks: 900, impressions: 6000, position: 2 }], // little upside
      ['/no-visibility/', { clicks: 0, impressions: 0, position: 40 }], // filtered out
    ]);
    const previous: SnapMap = new Map([
      ['/page-2-keyword/', { clicks: 60, impressions: 5200, position: 11 }], // recently slipped
      ['/already-ranking/', { clicks: 950, impressions: 6100, position: 2 }],
    ]);

    const recs = await getOptimizeRecommendations(repoOf(current, previous), 1, NOW);

    expect(recs.map((r) => r.page)).toEqual(['/page-2-keyword/', '/already-ranking/']);
    expect(recs[0].score).toBeGreaterThan(recs[1].score);
    expect(recs[0].previousPosition).toBe(11);
    expect(recs.some((r) => r.page === '/no-visibility/')).toBe(false);
  });

  it('honours the limit', async () => {
    const current: SnapMap = new Map(
      Array.from({ length: 30 }, (_, i) => [`/p${i}/`, { clicks: 1, impressions: 100 + i, position: 15 }] as const),
    );
    const recs = await getOptimizeRecommendations(repoOf(current, new Map()), 1, NOW, { limit: 5 });
    expect(recs).toHaveLength(5);
  });
});

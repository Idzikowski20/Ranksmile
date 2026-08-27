import { getWeeklyDrops } from '../../../../../src/core/application/gsc/getWeeklyDrops';
import type { ISnapshotRepository } from '../../../../../src/core/domain/gsc/snapshotRepository';
import type { SnapMap } from '../../../../../src/core/domain/gsc/drops';

const snap = (pages: Record<string, number>): SnapMap =>
  new Map(Object.entries(pages).map(([p, position]) => [p, { clicks: 1, impressions: 10, position }]));

// weekStartFor(2026-06-24) === '2026-06-15'; previous week === '2026-06-08'.
const NOW = new Date('2026-06-24T10:00:00Z');

describe('getWeeklyDrops use-case', () => {
  it('compares this week vs previous and flags a page that fell out of the top 10', async () => {
    const repo: ISnapshotRepository = {
      getSnapshot: async (_id, week) => (week === '2026-06-15' ? snap({ '/a': 8 }) : snap({ '/a': 4 })),
    };
    const r = await getWeeklyDrops(repo, 1, NOW);
    expect(r.hadBaseline).toBe(true);
    expect(r.hasDrops).toBe(true);
    expect(r.tiers.droppedInTop10.map((e) => e.page)).toEqual(['/a']);
  });

  it('reports hadBaseline=false when the previous week has no snapshot', async () => {
    const repo: ISnapshotRepository = {
      getSnapshot: async (_id, week) => (week === '2026-06-15' ? snap({ '/a': 8 }) : new Map()),
    };
    const r = await getWeeklyDrops(repo, 1, NOW);
    expect(r.hadBaseline).toBe(false);
  });
});

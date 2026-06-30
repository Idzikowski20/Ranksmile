import { computeDrops, SnapMap, PageSnap } from '../../lib/gscDrops';

const snap = (position: number, clicks = 0, impressions = 0): PageSnap => ({ position, clicks, impressions });
const map = (entries: Record<string, PageSnap>): SnapMap => new Map(Object.entries(entries));

describe('computeDrops', () => {
  it('flags a top-10 page that fell', () => {
    const r = computeDrops(map({ '/a': snap(8) }), map({ '/a': snap(4) }));
    expect(r.tiers.droppedInTop10.map((e) => e.page)).toEqual(['/a']);
    expect(r.tiers.droppedInTop10[0]).toMatchObject({ prevPos: 4, nowPos: 8 });
    expect(r.hasDrops).toBe(true);
  });
  it('flags a page that dropped across a tens boundary (10-block)', () => {
    const r = computeDrops(map({ '/b': snap(21) }), map({ '/b': snap(19) }));
    expect(r.tiers.droppedATier.map((e) => e.page)).toEqual(['/b']);
  });
  it('does NOT flag droppedATier when it fell but stayed in the same 10-block', () => {
    const r = computeDrops(map({ '/c': snap(18) }), map({ '/c': snap(12) }));
    expect(r.tiers.droppedATier).toEqual([]);
    expect(r.tiers.droppedInTop10).toEqual([]);
  });
  it('flags out-of-index (present last week, absent now)', () => {
    const r = computeDrops(map({}), map({ '/d': snap(7) }));
    expect(r.tiers.outOfIndex.map((e) => e.page)).toEqual(['/d']);
    expect(r.tiers.outOfIndex[0]).toMatchObject({ prevPos: 7, nowPos: null });
  });
  it('counts growth (improved >= 2) and newly-ranking pages', () => {
    const r = computeDrops(map({ '/e': snap(5), '/f': snap(12) }), map({ '/e': snap(9) }));
    expect(r.tiers.growth.map((e) => e.page).sort()).toEqual(['/e', '/f']);
    expect(r.hasDrops).toBe(false);
  });
  it('builds a domain summary (clicks/impressions WoW + fell/grew counts)', () => {
    const now = map({ '/a': snap(8, 10, 100), '/g': snap(3, 5, 50) });
    const prev = map({ '/a': snap(4, 20, 200), '/g': snap(6, 4, 40) });
    const r = computeDrops(now, prev);
    expect(r.summary).toMatchObject({ clicks: 15, prevClicks: 24, impressions: 150, prevImpressions: 240, pagesFell: 1, pagesGrew: 1 });
  });
});

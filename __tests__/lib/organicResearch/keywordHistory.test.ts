import { synthesizePositionHistory } from '../../../lib/organicResearch/synthesizePositionHistory';

describe('synthesizePositionHistory', () => {
  it('builds a sparse series from current + previous position', () => {
    const points = synthesizePositionHistory({
      position: 4,
      previousPosition: 12,
      change30d: 8,
      updatedAt: '2026-07-11T12:00:00.000Z',
    });
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points[points.length - 1]?.position).toBe(4);
    expect(points.some((p) => p.position === 12)).toBe(true);
  });

  it('returns empty when no current position', () => {
    expect(synthesizePositionHistory({
      position: null,
      previousPosition: 3,
      change30d: null,
    })).toEqual([]);
  });
});

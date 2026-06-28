import { weekStartFor, aggregateSevenDays } from '../../lib/gscWeek';

describe('weekStartFor', () => {
  it('returns the Monday of the PREVIOUS full week (UTC)', () => {
    expect(weekStartFor(new Date('2026-06-24T10:00:00Z'))).toBe('2026-06-15'); // Wed
    expect(weekStartFor(new Date('2026-06-22T08:00:00Z'))).toBe('2026-06-15'); // Monday
    expect(weekStartFor(new Date('2026-06-28T23:00:00Z'))).toBe('2026-06-15'); // Sunday
  });
});

describe('aggregateSevenDays', () => {
  it('sums clicks/impressions per page and impression-weights position', () => {
    const m = aggregateSevenDays([
      { page: '/a', clicks: 5, impressions: 100, position: 4 },
      { page: '/a', clicks: 3, impressions: 100, position: 6 }, // weighted avg = (4*100+6*100)/200 = 5
      { page: '/b', clicks: 1, impressions: 0, position: 10 },  // no impressions -> simple avg = 10
    ]);
    expect(m.get('/a')).toEqual({ clicks: 8, impressions: 200, position: 5 });
    expect(m.get('/b')).toEqual({ clicks: 1, impressions: 0, position: 10 });
  });
});

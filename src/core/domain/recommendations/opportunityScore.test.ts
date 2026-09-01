import { opportunityScore, strikingDistance } from './opportunityScore';

describe('opportunityScore', () => {
  it('rises with position inside the striking-distance band (deeper = more upside)', () => {
    // Surfer scores a page at 19 above one at 8 above one already in the top 3.
    expect(strikingDistance(19)).toBeGreaterThan(strikingDistance(8));
    expect(strikingDistance(8)).toBeGreaterThan(strikingDistance(2));
  });

  it('drops off for pages too deep to be a cheap win', () => {
    expect(strikingDistance(19)).toBeGreaterThan(strikingDistance(35));
    expect(strikingDistance(35)).toBeGreaterThan(strikingDistance(70));
  });

  it('ranks a deeper striking-distance page above a shallower one (Surfer monotonic)', () => {
    const deep = opportunityScore({ position: 19, previousPosition: 19, impressions: 4000 });
    const shallow = opportunityScore({ position: 14, previousPosition: 14, impressions: 4000 });
    expect(deep).toBeGreaterThan(shallow);
  });

  it('does NOT reward a recent drop — movement is context, not score', () => {
    const slipped = opportunityScore({ position: 19, previousPosition: 12, impressions: 3000 });
    const held = opportunityScore({ position: 19, previousPosition: 19, impressions: 3000 });
    expect(slipped).toBe(held);
  });

  it('rewards more impressions at the same position', () => {
    const busy = opportunityScore({ position: 15, previousPosition: 15, impressions: 8000 });
    const quiet = opportunityScore({ position: 15, previousPosition: 15, impressions: 50 });
    expect(busy).toBeGreaterThan(quiet);
  });

  it('ranks a striking-distance page above one already in the top 3', () => {
    const striking = opportunityScore({ position: 18, previousPosition: 18, impressions: 4000 });
    const alreadyTop = opportunityScore({ position: 2, previousPosition: 2, impressions: 4000 });
    expect(striking).toBeGreaterThan(alreadyTop);
  });

  it('stays within 0..10', () => {
    for (const p of [1, 5, 12, 19, 25, 45, 80]) {
      const s = opportunityScore({ position: p, previousPosition: p + 5, impressions: 100000 });
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
    }
  });
});

import { opportunityScore, strikingDistance, movementBoost } from './opportunityScore';

describe('opportunityScore', () => {
  it('peaks on page 2 (striking distance) over top-3 and deep pages', () => {
    expect(strikingDistance(15)).toBeGreaterThan(strikingDistance(2));
    expect(strikingDistance(15)).toBeGreaterThan(strikingDistance(60));
  });

  it('ranks a striking-distance page above one already in the top 3', () => {
    const striking = opportunityScore({ position: 18, previousPosition: 18, impressions: 4000 });
    const alreadyTop = opportunityScore({ position: 2, previousPosition: 2, impressions: 4000 });
    expect(striking).toBeGreaterThan(alreadyTop);
  });

  it('rewards more impressions at the same position', () => {
    const busy = opportunityScore({ position: 15, previousPosition: 15, impressions: 8000 });
    const quiet = opportunityScore({ position: 15, previousPosition: 15, impressions: 50 });
    expect(busy).toBeGreaterThan(quiet);
  });

  it('adds urgency when a page recently slipped', () => {
    const dropped = opportunityScore({ position: 19, previousPosition: 12, impressions: 3000 });
    const stable = opportunityScore({ position: 19, previousPosition: 19, impressions: 3000 });
    expect(dropped).toBeGreaterThan(stable);
  });

  it('boosts hardest when a page falls off page 1', () => {
    expect(movementBoost(14, 9)).toBeGreaterThan(movementBoost(14, 12));
  });

  it('stays within 0..10', () => {
    for (const p of [1, 5, 12, 19, 25, 45, 80]) {
      const s = opportunityScore({ position: p, previousPosition: p + 5, impressions: 100000 });
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(10);
    }
  });
});

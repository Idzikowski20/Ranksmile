import { mapPool } from '../../lib/mapPool';

describe('mapPool', () => {
  it('never runs more than concurrency workers at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);

    await mapPool(items, 3, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 20));
      inFlight -= 1;
      return n * 2;
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it('preserves result order', async () => {
    const out = await mapPool([1, 2, 3, 4], 2, async (n) => {
      await new Promise((r) => setTimeout(r, 5 * (5 - n)));
      return n * 10;
    });
    expect(out).toEqual([10, 20, 30, 40]);
  });
});

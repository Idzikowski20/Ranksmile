/**
 * The tick ring: N short strokes around a circle, each coloured by the segment it
 * belongs to, shares rounded so every segment with a value gets at least one tick and the
 * ticks add up to N exactly.
 */
import { tickRingTicks } from '@/src/core/domain/siteAudit/tickRing';

const seg = (id: string, value: number) => ({ id, label: id, value, color: `#${id}` });

describe('tickRingTicks', () => {
  it('splits the ticks proportionally and sums to the tick count', () => {
    const ticks = tickRingTicks([seg('a', 50), seg('b', 30), seg('c', 20)], 60);
    expect(ticks).toHaveLength(60);
    const count = (id: string) => ticks.filter((t) => t.segmentId === id).length;
    expect(count('a')).toBe(30);
    expect(count('b')).toBe(18);
    expect(count('c')).toBe(12);
  });

  it('gives every non-zero segment at least one tick even when its share rounds to none', () => {
    const ticks = tickRingTicks([seg('big', 999), seg('tiny', 1)], 60);
    expect(ticks.filter((t) => t.segmentId === 'tiny')).toHaveLength(1);
    expect(ticks).toHaveLength(60);
  });

  it('keeps every non-zero segment when one bucket dominates and the count is tight', () => {
    // 5 tiny buckets forced to 1 tick each over-allocate against a dominant one; the
    // rebalance must reclaim several ticks from it, not drop the tiny segments.
    const ticks = tickRingTicks(
      [seg('big', 1000), seg('a', 1), seg('b', 1), seg('c', 1), seg('d', 1), seg('e', 1)],
      8,
    );
    expect(ticks).toHaveLength(8);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'big']) {
      expect(ticks.filter((t) => t.segmentId === id).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('assigns the same tick counts regardless of the order equal segments arrive in', () => {
    const count = (segs: ReturnType<typeof seg>[]) => {
      const t = tickRingTicks(segs, 7);
      return Object.fromEntries(['x', 'y', 'z'].map((id) => [id, t.filter((k) => k.segmentId === id).length]));
    };
    expect(count([seg('x', 10), seg('y', 10), seg('z', 10)]))
      .toEqual(count([seg('z', 10), seg('y', 10), seg('x', 10)]));
  });

  it('skips zero-value segments and keeps the order given', () => {
    const ticks = tickRingTicks([seg('a', 0), seg('b', 10), seg('c', 10)], 4);
    expect(ticks.map((t) => t.segmentId)).toEqual(['b', 'b', 'c', 'c']);
  });

  it('renders an all-empty ring when there is nothing to show', () => {
    const ticks = tickRingTicks([seg('a', 0)], 12);
    expect(ticks).toHaveLength(12);
    expect(ticks.every((t) => t.segmentId === null)).toBe(true);
  });

  it('lays each tick out at an even angle starting from the top', () => {
    const ticks = tickRingTicks([seg('a', 1)], 4);
    expect(ticks.map((t) => t.angle)).toEqual([0, 90, 180, 270]);
  });
});

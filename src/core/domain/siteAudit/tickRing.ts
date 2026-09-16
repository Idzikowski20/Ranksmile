/**
 * The tick ring behind Site Health and AI Search Health: N short strokes around a
 * circle, each owned by the segment whose share it falls in. Shares are rounded with
 * largest remainder so the ticks always sum to N, and any segment with a value keeps at
 * least one tick — a 1-page bucket still shows up next to a 999-page one.
 */

export type TickRingSegment = { id: string; label: string; value: number; color: string };

export type RingTick = { index: number; angle: number; segmentId: string | null; color: string | null };

export function tickRingTicks(segments: TickRingSegment[], count: number): RingTick[] {
  const live = segments.filter((s) => s.value > 0);
  const total = live.reduce((sum, s) => sum + s.value, 0);
  const angleOf = (i: number) => (360 * i) / count;

  if (!live.length || total <= 0 || count <= 0) {
    return Array.from({ length: Math.max(0, count) }, (_, i) => ({ index: i, angle: angleOf(i), segmentId: null, color: null }));
  }

  // Exact shares, one tick guaranteed each, then largest remainder to hit `count`.
  const exact = live.map((s) => (s.value / total) * count);
  const floors = exact.map((e) => Math.max(1, Math.floor(e)));
  let left = count - floors.reduce((a, b) => a + b, 0);
  // Largest remainder first; break exact-remainder ties by id so the tick counts do not
  // depend on the order segments arrive in.
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e), id: live[i].id }))
    .sort((a, b) => (b.frac - a.frac) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (let k = 0; left > 0 && k < order.length; k += 1) {
    floors[order[k].i] += 1;
    left -= 1;
  }
  // Over-allocated by the "at least one" rule: take ticks back from the buckets with the
  // smallest remainders, repeating until balanced — one pass cannot remove several excess
  // ticks from the same bucket, which would drop nonzero segments at the final slice.
  while (left < 0) {
    let removed = false;
    for (let k = order.length - 1; left < 0 && k >= 0; k -= 1) {
      const i = order[k].i;
      if (floors[i] > 1) { floors[i] -= 1; left += 1; removed = true; }
    }
    if (!removed) break; // every bucket already at its minimum of one
  }

  const ticks: RingTick[] = [];
  live.forEach((s, si) => {
    for (let n = 0; n < floors[si]; n += 1) {
      const index = ticks.length;
      ticks.push({ index, angle: angleOf(index), segmentId: s.id, color: s.color });
    }
  });
  return ticks.slice(0, count);
}

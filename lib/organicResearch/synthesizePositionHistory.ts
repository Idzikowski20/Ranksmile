import type { KeywordPositionPoint } from '../../providers/dataforseo/historicalSerps';

/** Fallback when Labs history is empty — sparse series from current/previous metrics. */
export function synthesizePositionHistory(opts: {
  position: number | null;
  previousPosition: number | null;
  change30d: number | null;
  updatedAt?: string | null;
}): KeywordPositionPoint[] {
  const curr = opts.position;
  if (curr == null || curr <= 0) return [];

  let end = opts.updatedAt ? new Date(opts.updatedAt) : new Date();
  if (Number.isNaN(end.getTime())) end = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const d0 = new Date(end);
  d0.setDate(d0.getDate() - 90);
  const d1 = new Date(end);
  d1.setDate(d1.getDate() - 30);

  const prev = opts.previousPosition != null && opts.previousPosition > 0
    ? opts.previousPosition
    : opts.change30d != null
      ? Math.max(1, curr + opts.change30d)
      : null;

  const points: KeywordPositionPoint[] = [{ date: iso(d0), position: prev ?? curr }];
  if (prev != null) points.push({ date: iso(d1), position: prev });
  points.push({ date: iso(end), position: curr });
  return points;
}

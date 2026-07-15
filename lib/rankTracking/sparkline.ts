import type { RankHistorySummaryPoint } from '../types/rankTracking';

const DAY_MS = 86_400_000;

export type RankHistory7dStats = {
  best: number | null;
  current: number | null;
  position7dAgo: number | null;
};

export function computeHistory7dStats(
  points: RankHistorySummaryPoint[],
  currentPosition: number | null,
  found: boolean,
): RankHistory7dStats {
  const now = Date.now();
  const windowStart = now - 7 * DAY_MS;
  const target7d = now - 7 * DAY_MS;

  const ranked = points.filter((p) => p.found && p.position != null);
  const inWindow = ranked.filter((p) => new Date(p.date).getTime() >= windowStart);
  const current = found && currentPosition != null ? currentPosition : null;

  let best: number | null = inWindow.length
    ? Math.min(...inWindow.map((p) => p.position as number))
    : current;

  let position7dAgo: number | null = null;
  let closestDist = Infinity;
  for (const p of ranked) {
    const dist = Math.abs(new Date(p.date).getTime() - target7d);
    if (dist < closestDist) {
      closestDist = dist;
      position7dAgo = p.position as number;
    }
  }

  if (current != null) {
    best = best != null ? Math.min(best, current) : current;
  }

  return { best, current, position7dAgo };
}

export function sparklineFromHistoryPoints(points: RankHistorySummaryPoint[]): { values: number[]; color: string } {
  const ranked = [...points]
    .filter((p) => p.found && p.position != null)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (!ranked.length) {
    return { values: [], color: '#1fcdb0' };
  }

  const byDay = new Map<string, number>();
  for (const p of ranked) {
    byDay.set(new Date(p.date).toISOString().slice(0, 10), p.position as number);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = today.getTime() - 6 * DAY_MS;

  let carry = ranked[0].position as number;
  for (const p of ranked) {
    if (new Date(p.date).getTime() < windowStart) {
      carry = p.position as number;
    }
  }

  const values: number[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(windowStart + i * DAY_MS);
    const key = d.toISOString().slice(0, 10);
    const pos = byDay.get(key);
    if (pos != null) carry = pos;
    values.push(101 - carry);
  }

  const last7Ranked = ranked.filter((p) => new Date(p.date).getTime() >= windowStart);
  const colorSource = last7Ranked.length ? last7Ranked : ranked;
  const first = colorSource[0]?.position;
  const last = colorSource[colorSource.length - 1]?.position;

  let color = '#1fcdb0';
  if (first != null && last != null) {
    if (last < first) color = '#1AB25E';
    else if (last > first) color = '#FF6F77';
  }

  return { values, color };
}

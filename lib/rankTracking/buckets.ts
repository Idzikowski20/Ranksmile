import type { RankDevice, RankTrackingConfigRow, RankTrackingDeviceResult, RankTrackingRow } from '../types/rankTracking';

export function activeRankDevice(config: RankTrackingConfigRow): RankDevice {
  return config.devices === 'mobile' ? 'mobile' : 'desktop';
}

export function pickDeviceResult(row: RankTrackingRow, device: RankDevice): RankTrackingDeviceResult {
  return device === 'mobile' ? row.mobile : row.desktop;
}

export function visibilityContribution(position: number | null, found: boolean): number {
  if (!found || position == null) return 0;
  if (position <= 3) return 1.01;
  if (position <= 10) return 0.85;
  if (position <= 20) return 0.5;
  if (position <= 100) return 0.15;
  return 0;
}

function inTopN(position: number | null, found: boolean, max: number): boolean {
  return found && position != null && position <= max;
}

function wasInTopN(previousPosition: number | null, max: number): boolean {
  return previousPosition != null && previousPosition <= max;
}

/** Mutually exclusive bands (3, 4–10, 11–20, rest) — used by visibility percents. */
export function summarizeExclusiveBuckets(devs: RankTrackingDeviceResult[]): {
  top3: number;
  top10: number;
  top20: number;
  notRanking: number;
} {
  let top3 = 0;
  let top10 = 0;
  let top20 = 0;
  let notRanking = 0;
  for (const d of devs) {
    const p = d.position;
    if (!d.found || p == null) notRanking += 1;
    else if (p <= 3) top3 += 1;
    else if (p <= 10) top10 += 1;
    else if (p <= 20) top20 += 1;
    else notRanking += 1;
  }
  return { top3, top10, top20, notRanking };
}

/** Mutually exclusive bands for UI: Top 3 / Top 10 (4–10) / Top 100 (11–100) / Not ranking. */
export function summarizeUiBuckets(devs: RankTrackingDeviceResult[]): {
  top3: number;
  top10: number;
  top100: number;
  notRanking: number;
} {
  let top3 = 0;
  let top10 = 0;
  let top100 = 0;
  let notRanking = 0;
  for (const d of devs) {
    const p = d.position;
    if (!d.found || p == null) notRanking += 1;
    else if (p <= 3) top3 += 1;
    else if (p <= 10) top10 += 1;
    else if (p <= 100) top100 += 1;
    else notRanking += 1;
  }
  return { top3, top10, top100, notRanking };
}

export function exclusiveVisibilityPercents(
  counts: ReturnType<typeof summarizeExclusiveBuckets>,
  total: number,
): { top3: number; top10: number; top20: number; notRanking: number } {
  const t = total || 1;
  return {
    top3: Math.round((counts.top3 / t) * 100),
    top10: Math.round(((counts.top3 + counts.top10) / t) * 100),
    top20: Math.round(((counts.top3 + counts.top10 + counts.top20) / t) * 100),
    notRanking: Math.round((counts.notRanking / t) * 100),
  };
}

const CUMULATIVE_THRESHOLDS = [
  { key: 'top3' as const, max: 3 },
  { key: 'top10' as const, max: 10 },
  { key: 'top20' as const, max: 20 },
  { key: 'top100' as const, max: 100 },
];

export type CumulativeBucketSummary = {
  counts: Record<'top3' | 'top10' | 'top20' | 'top100', number>;
  newCounts: Record<'top3' | 'top10' | 'top20' | 'top100', number>;
  lostCounts: Record<'top3' | 'top10' | 'top20' | 'top100', number>;
};

/** Cumulative top-N counts + new/lost vs previous position — SEO overview widgets. */
export function summarizeCumulativeBuckets(devs: RankTrackingDeviceResult[]): CumulativeBucketSummary {
  const counts = { top3: 0, top10: 0, top20: 0, top100: 0 };
  const newCounts = { top3: 0, top10: 0, top20: 0, top100: 0 };
  const lostCounts = { top3: 0, top10: 0, top20: 0, top100: 0 };

  for (const d of devs) {
    for (const { key, max } of CUMULATIVE_THRESHOLDS) {
      const inTop = inTopN(d.position, d.found, max);
      const wasTop = wasInTopN(d.previousPosition, max);
      if (inTop) counts[key] += 1;
      if (inTop && !wasTop) newCounts[key] += 1;
      if (!inTop && wasTop) lostCounts[key] += 1;
    }
  }

  return { counts, newCounts, lostCounts };
}

import type { DistributionStats } from './types';

function sortedCopy(xs: number[]): number[] {
  return [...xs].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

export function distributionFrom(values: number[]): DistributionStats {
  const s = sortedCopy(values);
  const n = s.length;
  if (!n) {
    return { median: 0, p25: 0, p75: 0, min: 0, max: 0, mean: 0, n: 0 };
  }
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    median: Math.round(percentile(s, 0.5)),
    p25: Math.round(percentile(s, 0.25)),
    p75: Math.round(percentile(s, 0.75)),
    min: s[0],
    max: s[s.length - 1],
    mean: Math.round(sum / n),
    n,
  };
}

/** Flatten nested length arrays for distribution (e.g. all paragraphs across docs). */
export function flattenLengths(docs: number[][]): number[] {
  return docs.flat().filter((n) => Number.isFinite(n) && n > 0);
}

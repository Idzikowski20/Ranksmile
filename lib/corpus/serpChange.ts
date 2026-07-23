/** Pure SERP URL change helpers (no DB). */

/** Fraction of URLs that changed vs previous corpus (0–1). */
export function serpChangeRatio(prevUrls: string[], nextUrls: string[]): number {
  if (!prevUrls.length && !nextUrls.length) return 0;
  if (!prevUrls.length) return 1;
  const prev = new Set(prevUrls.map((u) => u.replace(/\/$/, '')));
  const next = new Set(nextUrls.map((u) => u.replace(/\/$/, '')));
  let shared = 0;
  for (const u of next) if (prev.has(u)) shared += 1;
  return 1 - shared / Math.max(prev.size, next.size);
}

export function shouldForceRefresh(changeRatio: number, threshold = 0.3): boolean {
  return changeRatio >= threshold;
}

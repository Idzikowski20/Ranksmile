// lib/scoreColor.ts
export type ScoreBand = 'low' | 'mid' | 'high';

const clamp = (n: number) => Math.max(0, Math.min(n, 100));

/**
 * `greenAt` is the "high" (green) floor. It defaults to 66 — the shared threshold every
 * gauge used before — so site-audit, crawled-pages and the ranksmile/Mini gauges are
 * unchanged. The article content-score trio (SEO / AI / blended) passes 70 to match
 * Surfer's editor, without recolouring the unrelated surfaces.
 */
export function scoreBand(score: number, greenAt = 66): ScoreBand {
  const s = clamp(score);
  if (s >= greenAt) return 'high';
  if (s >= 33) return 'mid';
  return 'low';
}

export function scoreColor(score: number, greenAt = 66): string {
  const band = scoreBand(score, greenAt);
  if (band === 'high') return '#1ab25e';
  if (band === 'mid') return '#efa00d';
  return '#d70028';
}

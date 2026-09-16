/**
 * Site Speed Score — the Lighthouse performance result (via PageSpeed Insights) reduced
 * to what the card shows: a 0–100 score, a verdict word, and four field metrics.
 *
 * Card label → Lighthouse metric: Load Time = LCP, Interactivity = TBT,
 * Visual Stability = CLS, Animation Load = Speed Index.
 */

export type SiteSpeedMetrics = {
  score: number;
  lcpMs: number | null;
  tbtMs: number | null;
  cls: number | null;
  speedIndexMs: number | null;
};

type PsiAudit = { numericValue?: unknown };
type PsiPayload = {
  lighthouseResult?: {
    categories?: { performance?: { score?: unknown } };
    audits?: Record<string, PsiAudit | undefined>;
  };
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** The PSI JSON → metrics, or null when it carries no performance score (error, quota). */
export function parsePageSpeedResult(raw: unknown): SiteSpeedMetrics | null {
  const lh = (raw as PsiPayload | null)?.lighthouseResult;
  const score01 = num(lh?.categories?.performance?.score);
  if (score01 === null) return null;
  const audit = (id: string) => num(lh?.audits?.[id]?.numericValue);
  const ms = (v: number | null) => (v === null ? null : Math.round(v));
  return {
    score: Math.round(score01 * 100),
    lcpMs: ms(audit('largest-contentful-paint')),
    tbtMs: ms(audit('total-blocking-time')),
    cls: audit('cumulative-layout-shift'),
    speedIndexMs: ms(audit('speed-index')),
  };
}

/** Lighthouse's own bands (90+ green, 50–89 orange, <50 red), with "Poor" for the bottom quarter. */
export function speedVerdict(score: number): string {
  if (score >= 90) return 'Great!';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Needs improvement';
  return 'Poor';
}

/** Where the handle sits on the Poor → Great bar. */
export function speedMarkerPercent(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** "2.54s" for millisecond metrics, a bare 1–2 decimal number for CLS, "—" when unknown. */
export function formatMetric(value: number | null, kind: 'ms' | 'cls'): string {
  if (value === null) return '—';
  if (kind === 'ms') return `${(value / 1000).toFixed(2)}s`;
  const rounded = Math.round(value * 100) / 100;
  return rounded < 0.01 ? '0.0' : String(rounded);
}

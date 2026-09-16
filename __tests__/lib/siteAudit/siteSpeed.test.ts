/**
 * Site Speed Score: the Lighthouse performance result from PageSpeed Insights, reduced
 * to the four numbers the card shows and a verdict word for the score.
 */
import { parsePageSpeedResult, speedVerdict, speedMarkerPercent, formatMetric } from '@/src/core/domain/siteAudit/siteSpeed';

const psi = (over: Record<string, unknown> = {}) => ({
  lighthouseResult: {
    categories: { performance: { score: 0.87 } },
    audits: {
      'largest-contentful-paint': { numericValue: 2540 },
      'total-blocking-time': { numericValue: 885.5 },
      'cumulative-layout-shift': { numericValue: 0.004 },
      'speed-index': { numericValue: 2540 },
    },
    ...over,
  },
});

describe('parsePageSpeedResult', () => {
  it('maps the Lighthouse categories and audits to the card metrics', () => {
    expect(parsePageSpeedResult(psi())).toEqual({
      score: 87,
      lcpMs: 2540,
      tbtMs: 886,
      cls: 0.004,
      speedIndexMs: 2540,
    });
  });

  it('rejects a payload without a performance score', () => {
    expect(parsePageSpeedResult({ lighthouseResult: { categories: {} } })).toBeNull();
    expect(parsePageSpeedResult(null)).toBeNull();
    expect(parsePageSpeedResult({ error: { message: 'quota' } })).toBeNull();
  });

  it('rejects a score outside the 0–1 Lighthouse range', () => {
    expect(parsePageSpeedResult(psi({ categories: { performance: { score: 1.1 } } }))).toBeNull();
    expect(parsePageSpeedResult(psi({ categories: { performance: { score: -0.1 } } }))).toBeNull();
    expect(parsePageSpeedResult(psi({ categories: { performance: { score: 0 } } }))?.score).toBe(0);
    expect(parsePageSpeedResult(psi({ categories: { performance: { score: 1 } } }))?.score).toBe(100);
  });

  it('tolerates a missing audit, reporting it as null rather than 0', () => {
    const out = parsePageSpeedResult(psi({ audits: { 'largest-contentful-paint': { numericValue: 1200 } } }));
    expect(out).toEqual({ score: 87, lcpMs: 1200, tbtMs: null, cls: null, speedIndexMs: null });
  });
});

describe('speedVerdict', () => {
  it('follows the Lighthouse bands', () => {
    expect(speedVerdict(95)).toBe('Great!');
    expect(speedVerdict(90)).toBe('Great!');
    expect(speedVerdict(89)).toBe('Good');
    expect(speedVerdict(50)).toBe('Good');
    expect(speedVerdict(49)).toBe('Needs improvement');
    expect(speedVerdict(0)).toBe('Poor');
    expect(speedVerdict(24)).toBe('Poor');
  });
});

describe('speedMarkerPercent', () => {
  it('places the handle along the 0–100 bar, clamped', () => {
    expect(speedMarkerPercent(87)).toBe(87);
    expect(speedMarkerPercent(-5)).toBe(0);
    expect(speedMarkerPercent(140)).toBe(100);
  });
});

describe('formatMetric', () => {
  it('shows seconds with two decimals for ms metrics and a bare number for CLS', () => {
    expect(formatMetric(2540, 'ms')).toBe('2.54s');
    expect(formatMetric(885.5, 'ms')).toBe('0.89s');
    expect(formatMetric(0.004, 'cls')).toBe('0.0');
    expect(formatMetric(0.25, 'cls')).toBe('0.25');
    expect(formatMetric(null, 'ms')).toBe('—');
  });
});

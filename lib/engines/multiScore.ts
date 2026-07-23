/**
 * Multi-score vector — SEO / AI / Coverage / Authority / Originality / Structure / GEO → Overall.
 */
export type MultiScoreInput = {
  seo: number;
  ai: number;
  coverage: number;
  authority?: number;
  originality?: number;
  structure?: number;
  geo?: number;
};

export type MultiScoreResult = MultiScoreInput & {
  overall: number;
  weights: Record<string, number>;
};

const DEFAULT_WEIGHTS: Record<keyof MultiScoreInput, number> = {
  seo: 0.28,
  ai: 0.22,
  coverage: 0.2,
  authority: 0.1,
  originality: 0.08,
  structure: 0.07,
  geo: 0.05,
};

export function computeMultiScore(
  input: MultiScoreInput,
  weights: Partial<Record<keyof MultiScoreInput, number>> = {},
): MultiScoreResult {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const parts: Array<[keyof MultiScoreInput, number]> = [
    ['seo', clamp(input.seo)],
    ['ai', clamp(input.ai)],
    ['coverage', clamp(input.coverage)],
    ['authority', clamp(input.authority ?? input.seo * 0.8)],
    ['originality', clamp(input.originality ?? 50)],
    ['structure', clamp(input.structure ?? input.seo * 0.7)],
    ['geo', clamp(input.geo ?? 40)],
  ];

  let sumW = 0;
  let sum = 0;
  const used: Record<string, number> = {};
  for (const [k, v] of parts) {
    const wk = w[k] ?? 0;
    if (wk <= 0) continue;
    sumW += wk;
    sum += v * wk;
    used[k] = wk;
  }
  const overall = sumW > 0 ? Math.round(sum / sumW) : 0;
  return {
    seo: clamp(input.seo),
    ai: clamp(input.ai),
    coverage: clamp(input.coverage),
    authority: clamp(input.authority ?? input.seo * 0.8),
    originality: clamp(input.originality ?? 50),
    structure: clamp(input.structure ?? input.seo * 0.7),
    geo: clamp(input.geo ?? 40),
    overall,
    weights: used,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

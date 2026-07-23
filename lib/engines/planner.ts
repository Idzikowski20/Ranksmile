/**
 * Planner — ROI + confidence ranking over Actions (Feature Store vectors, no LLM ranking).
 */
import type { Action, Feature } from '../primitives/types';

export type PlannerCandidate = Action & {
  roi: number;
  plannerConfidence: number;
};

export type PlannerResult = {
  ranked: PlannerCandidate[];
  totalExpectedLift: number;
};

function costUnits(c: Action['cost']): number {
  if (c === 'easy') return 1;
  if (c === 'medium') return 2.5;
  return 5;
}

export function planActions(opts: {
  actions: Action[];
  features?: Feature[];
  maxActions?: number;
}): PlannerResult {
  const featureBoost = new Map<string, number>();
  for (const f of opts.features ?? []) {
    featureBoost.set(f.id, f.confidence * (f.score.value ?? f.score.score) / 100);
  }

  const ranked: PlannerCandidate[] = opts.actions.map((a) => {
    const boost = a.featureId ? featureBoost.get(a.featureId) ?? 0 : 0;
    const conf = Math.min(0.99, (a.confidence ?? 0.5) * (0.85 + 0.15 * boost));
    const lift = a.expectedLift ?? 1;
    const roi = (lift * conf) / costUnits(a.cost);
    return { ...a, roi, plannerConfidence: conf };
  });

  ranked.sort((a, b) => b.roi - a.roi || b.expectedLift - a.expectedLift);
  const sliced = ranked.slice(0, opts.maxActions ?? 15);
  return {
    ranked: sliced,
    totalExpectedLift: sliced.reduce((s, a) => s + (a.expectedLift ?? 0), 0),
  };
}

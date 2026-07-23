/**
 * Recommendation Engine (v7 path) — gaps → prioritized Actions.
 * Sits after Gap Engine; does not re-judge coverage.
 */
import type { Action } from '../primitives/types';
import type { CoverageGap } from './gapEngine';

export type RecoEngineResult = {
  actions: Action[];
};

function actionTypeFor(gap: CoverageGap): Action['type'] {
  if (gap.type === 'question' || gap.type === 'paa') return 'cover_question';
  if (gap.type === 'entity') return 'add_entity';
  if (gap.type === 'fact') return 'expand_section';
  return 'add_entity';
}

export function runRecommendationEngine(opts: {
  gaps: CoverageGap[];
  articleId?: number;
  domainId?: number;
  maxActions?: number;
}): RecoEngineResult {
  const max = opts.maxActions ?? 12;
  const actions: Action[] = opts.gaps.slice(0, max).map((g, i) => {
    const lift = Math.round(g.informationGain * 12 * 10) / 10;
    const cost: Action['cost'] =
      g.importance === 'critical' ? 'medium' : g.type === 'term' ? 'easy' : 'medium';
    return {
      id: `reco-${g.itemId}-${i}`,
      type: actionTypeFor(g),
      title: g.covered ? `Deepen: ${g.label}` : `Cover: ${g.label}`,
      instruction: g.covered
        ? `Expand coverage of "${g.label}" with clearer explanation and evidence.`
        : `Add a clear passage covering "${g.label}".`,
      expectedLift: lift,
      confidence: Math.min(0.95, 0.45 + g.informationGain * 0.5),
      cost,
      reason: g.evidence[0]?.detail || 'Coverage gap',
      origin: 'coverage',
      appliesTo: {
        kind: 'article',
        id: opts.articleId != null ? String(opts.articleId) : undefined,
      },
      generatedBy: 'gapToReco',
      featureId: 'coverage',
    };
  });

  return { actions };
}

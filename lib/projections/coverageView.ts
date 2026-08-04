import type { CanonicalContentModel } from '../ccm/types/ccm';
import type { CoverageViewSummary } from '../ccm/types/slices';
import { graphQuery } from '../ccm/graphQuery';

export type CoverageView = CoverageViewSummary & {
  readonly weakFacts: number;
  readonly factsWithEvidence: number;
  readonly weakFactIds: readonly string[];
  readonly missingIntentIds: readonly string[];
  readonly coveredFactIds: readonly string[];
};

/**
 * Coverage projection from CCM via GraphQuery (not an engine).
 */
export function projectCoverage(model: CanonicalContentModel): CoverageView {
  const q = graphQuery(model);
  const facts = q.findFacts();
  const intents = q.findIntents();

  const weakFactIds = q.findFacts({ status: 'weak' }).map((f) => f.id);
  const coveredFacts = q.findFacts({ status: ['covered', 'partial'] });
  const factsWithEvidence = q.findFacts({ hasEvidence: true }).length;

  const coveredIntentIds: string[] = [];
  const missingIntentIds: string[] = [];
  for (const intent of intents) {
    const supporters = q.neighbors(intent.id, 'supports', 'in');
    if (supporters.length > 0) coveredIntentIds.push(intent.id);
    else missingIntentIds.push(intent.id);
  }

  const totalFacts = facts.length;
  const totalIntents = intents.length;
  const factRatio = totalFacts === 0 ? 1 : coveredFacts.length / totalFacts;
  const intentRatio = totalIntents === 0 ? 1 : coveredIntentIds.length / totalIntents;
  const evidenceRatio = totalFacts === 0 ? 1 : factsWithEvidence / totalFacts;
  const overall =
    Math.round((0.45 * factRatio + 0.35 * intentRatio + 0.2 * evidenceRatio) * 1000) /
    1000;

  return {
    overall,
    coveredFacts: coveredFacts.length,
    totalFacts,
    coveredIntents: coveredIntentIds.length,
    totalIntents,
    weakFacts: weakFactIds.length,
    factsWithEvidence,
    weakFactIds,
    missingIntentIds,
    coveredFactIds: coveredFacts.map((f) => f.id),
  };
}

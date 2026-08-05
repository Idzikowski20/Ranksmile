import type { CanonicalContentModel } from '../ccm/types/ccm';
import { graphQuery } from '../ccm/graphQuery';
import { isFactNode } from '../ccm/types/graph';

export type VisibilityCluster = {
  readonly id: string;
  readonly label: string;
  readonly factIds: readonly string[];
  /** 0..1 — fraction of cluster facts that are covered/partial with evidence */
  readonly completeness: number;
  readonly avgConfidence: number;
};

export type VisibilityProjection = {
  /** 0..1 overall atomic completeness */
  readonly completeness: number;
  readonly atomicFactCount: number;
  readonly coveredAtomicCount: number;
  readonly clusters: readonly VisibilityCluster[];
};

function factComplete(
  model: CanonicalContentModel,
  factId: string,
): boolean {
  const q = graphQuery(model);
  const fact = q.node(factId);
  if (!fact || !isFactNode(fact)) return false;
  if (fact.status !== 'covered' && fact.status !== 'partial') return false;
  return q.findFacts({ hasEvidence: true }).some((f) => f.id === factId);
}

/**
 * Visibility projection: Atomic Facts → Cluster → Completeness.
 * Clusters = intents (facts supporting them) + ungrouped remainder.
 */
export function projectVisibility(model: CanonicalContentModel): VisibilityProjection {
  const q = graphQuery(model);
  const facts = q.findFacts();
  const intents = q.findIntents();
  const assigned = new Set<string>();
  const clusters: VisibilityCluster[] = [];

  for (const intent of intents) {
    const supporting = q.neighbors(intent.id, 'supports', 'in').filter(isFactNode);
    if (supporting.length === 0) {
      clusters.push({
        id: `vis_${intent.id}`,
        label: intent.label,
        factIds: [],
        completeness: 0,
        avgConfidence: 0,
      });
      continue;
    }
    const factIds = supporting.map((f) => f.id);
    for (const id of factIds) assigned.add(id);
    const complete = factIds.filter((id) => factComplete(model, id)).length;
    const avgConfidence =
      supporting.reduce((s, f) => s + f.confidence, 0) / supporting.length;
    clusters.push({
      id: `vis_${intent.id}`,
      label: intent.label,
      factIds,
      completeness: Math.round((complete / factIds.length) * 1000) / 1000,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    });
  }

  const ungrouped = facts.filter((f) => !assigned.has(f.id));
  if (ungrouped.length > 0) {
    const factIds = ungrouped.map((f) => f.id);
    const complete = factIds.filter((id) => factComplete(model, id)).length;
    clusters.push({
      id: 'vis_ungrouped',
      label: 'Ungrouped',
      factIds,
      completeness: Math.round((complete / factIds.length) * 1000) / 1000,
      avgConfidence:
        Math.round(
          (ungrouped.reduce((s, f) => s + f.confidence, 0) / ungrouped.length) * 1000,
        ) / 1000,
    });
  }

  const atomicFactCount = facts.length;
  const coveredAtomicCount = facts.filter((f) => factComplete(model, f.id)).length;
  const completeness =
    atomicFactCount === 0
      ? 1
      : Math.round((coveredAtomicCount / atomicFactCount) * 1000) / 1000;

  return {
    completeness,
    atomicFactCount,
    coveredAtomicCount,
    clusters,
  };
}

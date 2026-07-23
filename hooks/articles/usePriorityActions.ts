import { useEffect, useMemo, useState } from 'react';
import type { Action, Observation, Strategy, StrategyId } from '../../lib/primitives/types';
import { applyStrategy, prioritizeActions } from '../../lib/primitives/prioritizeActions';
import { coverageActionsFromSnapshot } from '../../lib/features/featureEngine';
import { actionsFromObservations } from '../../lib/observations/actionsFromObservations';
import type { CoverageSnapshot } from '../../lib/aiCoverage';

const STRATEGIES: Array<{ id: StrategyId | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'quick_wins', label: 'Quick wins' },
  { id: 'content_score_focus', label: 'Content' },
  { id: 'ai_visibility_focus', label: 'AI Vis' },
];

export { STRATEGIES };

/**
 * Coverage Feature actions + Observation-derived actions, filtered by Strategy.
 */
export function usePriorityActions(
  articleId: number | undefined,
  coverageSnapshot: CoverageSnapshot | null | undefined,
  strategyId: StrategyId | 'all',
): { actions: Action[]; observations: Observation[]; loading: boolean } {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!articleId) {
      setObservations([]);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/articles/${articleId}/growth-history?featureId=coverage`)
      .then(async (res) => {
        if (!res.ok) return [] as Observation[];
        const data = (await res.json()) as { observations?: Observation[] };
        return data.observations || [];
      })
      .then((obs) => {
        if (!cancelled) setObservations(obs);
      })
      .catch(() => {
        if (!cancelled) setObservations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const actions = useMemo(() => {
    const fromCoverage = coverageSnapshot ? coverageActionsFromSnapshot(coverageSnapshot) : [];
    const fromObs = actionsFromObservations(observations);
    // Prefer coverage Action when same id; observation acts use act- prefix so rare clash.
    const merged = prioritizeActions([...fromCoverage, ...fromObs]);
    if (strategyId === 'all') return merged.slice(0, 8);
    const strategy: Strategy = { id: strategyId, label: strategyId };
    return applyStrategy(merged, strategy).slice(0, 8);
  }, [coverageSnapshot, observations, strategyId]);

  return { actions, observations, loading };
}

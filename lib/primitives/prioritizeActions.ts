import type { Action, Strategy } from './types';

const COST_RANK: Record<Action['cost'], number> = { easy: 0, medium: 1, large: 2 };

/**
 * Thin recommendation engine: sort / prioritize / merge / dedupe Action[].
 * Must NOT import coverage or AI Visibility domain modules.
 */
export function prioritizeActions(actions: readonly Action[]): Action[] {
  const byId = new Map<string, Action>();
  for (const a of actions) {
    const prev = byId.get(a.id);
    if (!prev || a.expectedLift > prev.expectedLift) {
      byId.set(a.id, a);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const lift = b.expectedLift - a.expectedLift;
    if (lift !== 0) return lift;
    const conf = b.confidence - a.confidence;
    if (conf !== 0) return conf;
    return COST_RANK[a.cost] - COST_RANK[b.cost];
  });
}

/** Apply a Strategy filter/cap after prioritizeActions. */
export function applyStrategy(actions: readonly Action[], strategy?: Strategy): Action[] {
  let list = [...actions];
  if (strategy?.id === 'quick_wins') {
    list = list.filter((a) => a.cost === 'easy' || a.expectedLift >= 8);
  } else if (strategy?.id === 'ai_visibility_focus') {
    list = list.filter((a) => a.origin === 'visibility' || a.featureId === 'visibility');
  } else if (strategy?.id === 'content_score_focus') {
    list = list.filter((a) => a.origin === 'coverage' || a.featureId === 'coverage');
  }
  if (strategy?.maxActions != null) {
    list = list.slice(0, strategy.maxActions);
  }
  return list;
}

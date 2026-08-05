import type { ActionGraph, EditAction } from '../ccm/types/actionGraph';
import type {
  ActionBudget,
  ConsumerContext,
  ConsumerResult,
  ContentConsumer,
} from '../intelligence/consumerContext';
import { buildActionGraph } from './actionGraphBuilder';

export type PlannerStrategy = 'fast' | 'balanced' | 'aggressive' | 'enterprise';

export type EditPlan = {
  readonly fromCcmVersion: number;
  readonly fromActionGraphHash: string;
  readonly strategy: PlannerStrategy;
  readonly selected: readonly EditAction[];
  readonly deferred: readonly string[];
};

const STRATEGY_LIMIT: Record<PlannerStrategy, number> = {
  fast: 3,
  balanced: 5,
  aggressive: 10,
  enterprise: 20,
};

/**
 * Stateless planner: subset ActionGraph under budget. Does not invent actions.
 */
export function planActions(
  actionGraph: ActionGraph,
  budget: ActionBudget,
  strategy: PlannerStrategy = 'balanced',
): EditPlan {
  const limit = Math.min(budget.maxActions, STRATEGY_LIMIT[strategy]);
  const sorted = [...actionGraph.actions].sort((a, b) => a.priority - b.priority);
  const selected: EditAction[] = [];
  const deferred: string[] = [];
  const selectedIds = new Set<string>();

  for (const action of sorted) {
    if (selected.length >= limit) {
      deferred.push(action.id);
      continue;
    }
    const depsOk = action.dependsOn.every((d) => selectedIds.has(d));
    if (!depsOk) {
      deferred.push(action.id);
      continue;
    }
    selected.push(action);
    selectedIds.add(action.id);
  }

  return {
    fromCcmVersion: actionGraph.fromCcmVersion,
    fromActionGraphHash: actionGraph.fromKnowledgeGraphHash,
    strategy,
    selected,
    deferred,
  };
}

export const plannerConsumer: ContentConsumer<EditPlan> = {
  id: 'planner',
  accept(context: ConsumerContext): ConsumerResult<EditPlan> {
    const graph =
      context.actionGraph ??
      buildActionGraph(context.model, { builtAt: context.model.compiledAt });
    const budget = context.budget ?? { maxActions: 5, maxLlmCalls: 0 };
    const strategy: PlannerStrategy = 'balanced';
    const result = planActions(graph, budget, strategy);
    return {
      consumerId: 'planner',
      fromCcmVersion: context.model.version,
      confidence: 1,
      result,
      recommendations: result.selected,
      trace: {
        notes: [
          `selected=${result.selected.length}`,
          `deferred=${result.deferred.length}`,
          `strategy=${strategy}`,
        ],
      },
    };
  },
};

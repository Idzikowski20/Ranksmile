import type { Action, ActionExecution, Observation } from './types';

/**
 * Action → Executor → Done.
 * Q2: registry + stubs; LLM/WP side-effects attach later without changing Action shape.
 */
export type ActionExecutor = {
  id: string;
  canExecute: (action: Action) => boolean;
  execute: (action: Action, observations?: Observation[]) => Promise<ActionExecution>;
};

export function pendingExecution(actionId: string, executor: string): ActionExecution {
  return {
    actionId,
    status: 'pending',
    executor,
    startedAt: new Date().toISOString(),
  };
}

function finish(
  actionId: string,
  executor: string,
  status: ActionExecution['status'],
  extra?: Partial<ActionExecution>,
): ActionExecution {
  return {
    actionId,
    status,
    executor,
    startedAt: new Date().toISOString(),
    finishedAt: status === 'done' || status === 'failed' ? new Date().toISOString() : undefined,
    ...extra,
  };
}

/** Manual — marks done when user confirms in UI (no side effects). */
export const manualExecutor: ActionExecutor = {
  id: 'manual',
  canExecute: () => true,
  async execute(action) {
    return finish(action.id, 'manual', 'done', { resultRef: `manual:${action.id}` });
  },
};

/** LLM stub — ready for AO / rewrite wiring. */
export const llmExecutor: ActionExecutor = {
  id: 'llm',
  canExecute: (action) =>
    ['rewrite_section', 'expand_section', 'add_faq', 'cover_question', 'fix_heading', 'create_outline'].includes(
      String(action.type),
    ),
  async execute(action) {
    return pendingExecution(action.id, 'llm');
  },
};

/** WordPress — propose publish; never auto-publishes. */
export const wpPluginExecutor: ActionExecutor = {
  id: 'wp_plugin',
  canExecute: (action) => action.type === 'publish',
  async execute(action) {
    return pendingExecution(action.id, 'wp_plugin');
  },
};

/** CMS — internal links / structural writes. */
export const cmsExecutor: ActionExecutor = {
  id: 'cms',
  canExecute: (action) => action.type === 'add_internal_link' || action.type === 'publish',
  async execute(action) {
    return pendingExecution(action.id, 'cms');
  },
};

const DEFAULT_EXECUTORS: ActionExecutor[] = [llmExecutor, wpPluginExecutor, cmsExecutor, manualExecutor];

export function pickExecutor(action: Action, executors: ActionExecutor[] = DEFAULT_EXECUTORS): ActionExecutor {
  const match = executors.find((e) => e.id !== 'manual' && e.canExecute(action));
  return match || manualExecutor;
}

export async function executeAction(
  action: Action,
  opts?: { observations?: Observation[]; executors?: ActionExecutor[]; prefer?: string },
): Promise<ActionExecution> {
  const list = opts?.executors || DEFAULT_EXECUTORS;
  const preferred = opts?.prefer ? list.find((e) => e.id === opts.prefer && e.canExecute(action)) : undefined;
  const executor = preferred || pickExecutor(action, list);
  return executor.execute(action, opts?.observations);
}

export function listExecutors(): ActionExecutor[] {
  return [...DEFAULT_EXECUTORS];
}

import type { Action, ActionExecution } from './primitives/types';
import { executeAction, pickExecutor } from './primitives/actionExecutor';
import { getErrorMessage } from './errors';

async function recordActionEvent(
  payload: Record<string, unknown>,
  ids: { articleId: number; domainId?: number },
): Promise<void> {
  if (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test') return;
  try {
    const { persistDomainEvent } = await import('./growthMetaStore');
    await persistDomainEvent('ActionExecuted', payload, ids);
  } catch (err: unknown) {
    console.warn('[action] event persist failed:', getErrorMessage(err));
  }
}

/**
 * Execute an Action with real side-effect hooks.
 * - LLM types → status running + resultRef pointing at AO entrypoints (client triggers AO)
 * - publish → pending until WP confirm modal completes
 * - manual → done immediately
 */
export async function runActionExecution(opts: {
  action: Action;
  articleId: number;
  domainId?: number;
  /** User confirmed WP publish in UI. */
  confirmed?: boolean;
}): Promise<ActionExecution> {
  const { action, articleId, confirmed } = opts;
  const executor = pickExecutor(action);
  const ids = { articleId, domainId: opts.domainId };

  if (executor.id === 'wp_plugin' || action.type === 'publish') {
    if (!confirmed) {
      const pending = await executeAction(action, { prefer: 'wp_plugin' });
      return { ...pending, status: 'pending', resultRef: `wp:confirm:${articleId}` };
    }
    const done: ActionExecution = {
      actionId: action.id,
      status: 'done',
      executor: 'wp_plugin',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      resultRef: `wp:published:${articleId}`,
    };
    await recordActionEvent({ actionId: action.id, type: action.type, executor: 'wp_plugin' }, ids);
    return done;
  }

  if (executor.id === 'llm') {
    const started: ActionExecution = {
      actionId: action.id,
      status: 'running',
      executor: 'llm',
      startedAt: new Date().toISOString(),
      resultRef:
        action.type === 'add_faq' || action.type === 'cover_question'
          ? `ao:faq:${articleId}`
          : `ao:rewrite:${articleId}:${action.appliesTo?.id || action.id}`,
    };
    await recordActionEvent(
      {
        actionId: action.id,
        type: action.type,
        executor: 'llm',
        resultRef: started.resultRef,
        note: 'Client should invoke Auto-Optimize / FAQ AO for the side-effect',
      },
      ids,
    );
    try {
      const { recordOptimization } = await import('./learning/learningLoop');
      await recordOptimization({
        workspaceId: String(opts.domainId ?? articleId),
        articleId,
        changeType: action.type,
        changeDetail: { actionId: action.id, status: 'running', executor: 'llm' },
      });
    } catch {
      /* non-fatal */
    }
    return started;
  }

  const result = await executeAction(action, { prefer: executor.id });
  await recordActionEvent(
    { actionId: action.id, type: action.type, executor: result.executor, status: result.status },
    ids,
  );

  if (result.status === 'done' || result.status === 'running') {
    try {
      const { recordOptimization } = await import('./learning/learningLoop');
      await recordOptimization({
        workspaceId: String(opts.domainId ?? articleId),
        articleId,
        changeType: action.type,
        changeDetail: {
          actionId: action.id,
          title: action.title,
          expectedLift: action.expectedLift,
          executor: result.executor,
        },
        beforeScore: typeof action.expectedLift === 'number' ? undefined : undefined,
        afterScore: undefined,
      });
    } catch (err: unknown) {
      console.warn('[action] optimization history failed:', getErrorMessage(err));
    }
  }

  return result;
}

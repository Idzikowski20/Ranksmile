/**
 * Pure scheduling decisions for the Automations cron. The runner does the I/O (create
 * draft, trigger generation, publish); these functions decide WHAT to do, so the branching
 * is testable without a database.
 */
import type { AutomationPublishMode } from '@/src/core/shared/types/automations';

/** A scheduled event is due once its day has arrived (YYYY-MM-DD compares lexically). */
export function isDue(scheduledDate: string, todayKey: string): boolean {
  return scheduledDate.slice(0, 10) <= todayKey;
}

export type GenerationState = 'pending' | 'done' | 'failed';

/**
 * What to do with an event already in `generating` on this tick:
 * - wait: content is still being written;
 * - publish: live intent and content is ready → push to WordPress;
 * - complete: draft-only intent (or live with no content yet) → mark the draft ready;
 * - fail: generation itself failed.
 */
export type FinalizeAction = 'wait' | 'publish' | 'complete' | 'fail';

export function finalizeAction(
  publishMode: AutomationPublishMode,
  generation: GenerationState,
  hasContent: boolean,
): FinalizeAction {
  if (generation === 'failed') return 'fail';
  if (generation === 'pending') return 'wait';
  if (publishMode === 'live' && hasContent) return 'publish';
  return 'complete';
}

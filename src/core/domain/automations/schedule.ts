/**
 * Pure scheduling decisions for the Automations cron. The runner does the I/O (create
 * draft, trigger generation, publish); these functions decide WHAT to do, so the branching
 * is testable without a database.
 */
import type { AutomationPublishMode } from '@/src/core/shared/types/automations';

/** A valid IANA time zone name (as the browser reports it), else null. */
export function normalizeTimeZone(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw || raw.length > 64) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: raw }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/** YYYY-MM-DD of `now` in `timeZone` — the day the user picked on their calendar. UTC if unknown. */
export function dateKeyIn(now: Date, timeZone: string | null | undefined): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: normalizeTimeZone(timeZone) ?? 'UTC' }).format(now);
}

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

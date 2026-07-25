/** First-run vs follow-up Auto-Optimize — Ranksmile-style progressive tightening. */

export type OptimizePhase = 'first_run' | 'follow_up';

export type AoMeta = {
  changes?: number;
  promptVersion?: string;
  creditDeducted?: boolean;
  runs?: number;
  lastContentScore?: number;
  lastSeo?: number;
  lastAi?: number;
};

export const TARGET_CONTENT_FIRST = 80;
export const TARGET_CONTENT_FOLLOW_UP = 90;
export const MAX_ROUNDS_FIRST = 4;
export const MAX_ROUNDS_FOLLOW_UP = 2;

export function resolveOptimizePhase(opts: {
  contentScore: number;
  aoMeta?: AoMeta | null;
  hasPriorAutoOptimizeVersion?: boolean;
}): OptimizePhase {
  if (opts.hasPriorAutoOptimizeVersion) return 'follow_up';
  if ((opts.aoMeta?.runs ?? 0) >= 1) return 'follow_up';
  if (opts.contentScore >= TARGET_CONTENT_FIRST) return 'follow_up';
  return 'first_run';
}

export function maxRoundsForPhase(phase: OptimizePhase): number {
  return phase === 'first_run' ? MAX_ROUNDS_FIRST : MAX_ROUNDS_FOLLOW_UP;
}

export function targetContentForPhase(phase: OptimizePhase): number {
  return phase === 'first_run' ? TARGET_CONTENT_FIRST : TARGET_CONTENT_FOLLOW_UP;
}

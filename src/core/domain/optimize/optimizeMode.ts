/** Ranksmile-style Auto-Optimize routing — SEO vs AI Search focus. */

import type { OptimizePhase } from '@/src/core/domain/optimize/runPhase';

export type OptimizeMode = 'full' | 'ai-only' | 'seo-first' | 'minimal';

// 80, not 66: the user-facing contract (and Surfer's) is "strong SEO means touch-ups
// only" — 66 counted a mediocre article as done and routed real SEO work to ai-only.
export const SEO_READY = 80;
export const SEO_WEAK = 40;
/** Below this the article gets REBUILT toward the plan, generator-style. */
export const SEO_REBUILD_BELOW = 60;
export const AI_WEAK = 50;
/** Skip / already_optimal: SEO≥90 AND AI≥85 (v4.1). */
export const TARGET_SEO = 90;
export const TARGET_AI = 85;
export const DEFAULT_MAX_ROUNDS = 2;
export const AI_GAP = 25;

/**
 * P0 safety no-op: both score targets met → zero LLM.
 * SPEC: this is NOT final quality-based stopping (P1 adds intent + critical gaps).
 */
export function shouldSkipOptimize(seoScore: number, aiScore: number): boolean {
  return seoScore >= TARGET_SEO && aiScore >= TARGET_AI;
}

function selectFirstRunMode(seoScore: number, aiScore: number): OptimizeMode {
  // SEO already good → push AI Search until TARGET_AI (do not early-exit at TARGET_AI-5).
  if (seoScore >= SEO_READY && aiScore >= TARGET_AI) return 'minimal';
  if (seoScore >= SEO_READY) return 'ai-only';
  // A weak article gets rebuilt toward the plan, like the generator would write it.
  if (seoScore < SEO_REBUILD_BELOW) return 'full';
  return 'seo-first';
}

export function selectOptimizeMode(
  seoScore: number,
  aiScore: number,
  _phase: OptimizePhase = 'first_run',
): OptimizeMode {
  // Mode comes from the CURRENT scores, never from run history. The old
  // `follow_up → minimal` short-circuit meant one prior AO run (even a no-op that
  // changed nothing) locked the article out of real work forever: a degraded article
  // at SEO 68 got mode minimal and one cosmetic edit. Anti-loop protection lives in
  // the stagnation gate, not here; phase still tightens targets and round budgets.
  return selectFirstRunMode(seoScore, aiScore);
}

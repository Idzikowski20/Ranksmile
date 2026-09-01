/** Ranksmile-style Auto-Optimize routing — SEO vs AI Search focus. */

import type { OptimizePhase } from './optimizeRunPhase';

export type OptimizeMode = 'full' | 'ai-only' | 'seo-first' | 'minimal';

export const SEO_READY = 66;
export const SEO_WEAK = 40;
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
  if (seoScore < SEO_WEAK && aiScore < SEO_WEAK) return 'full';
  if (seoScore < SEO_READY) return 'seo-first';
  return 'full';
}

export function selectOptimizeMode(
  seoScore: number,
  aiScore: number,
  phase: OptimizePhase = 'first_run',
): OptimizeMode {
  if (phase === 'follow_up') return 'minimal';
  return selectFirstRunMode(seoScore, aiScore);
}

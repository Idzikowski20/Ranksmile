/** Surfer-style Auto-Optimize routing — SEO vs AI Search focus. */

import type { OptimizePhase } from './optimizeRunPhase';

export type OptimizeMode = 'full' | 'ai-only' | 'seo-first' | 'minimal';

export const SEO_READY = 66;
export const SEO_WEAK = 40;
export const AI_WEAK = 50;
export const TARGET_SEO = 80;
export const TARGET_AI = 65;
export const DEFAULT_MAX_ROUNDS = 2;
export const AI_GAP = 25;

function selectFirstRunMode(seoScore: number, aiScore: number): OptimizeMode {
  if (seoScore >= SEO_READY && aiScore >= TARGET_AI - 5) return 'minimal';
  if (seoScore >= SEO_READY && aiScore < AI_WEAK) return 'ai-only';
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

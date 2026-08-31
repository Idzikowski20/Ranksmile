/**
 * Opportunity score for the `optimize` recommendation type — a pure, testable model of
 * Surfer's Content Audit prioritisation.
 *
 * Surfer surfaces pages in "striking distance" (positions ~4–20 — close to page 1, the
 * cheapest wins) and weights them by traffic potential and recent movement. This mirrors
 * that: a striking-distance factor (peaks on page 2), a traffic factor from impressions,
 * and a movement boost for pages that recently slipped. Weights are named so they can be
 * tuned against real GSC outcomes later.
 */

export interface ScoreInput {
  position: number;
  previousPosition: number | null;
  impressions: number;
}

const W_STRIKING = 0.6;
const W_TRAFFIC = 0.3;
const W_MOVEMENT = 0.1;

/** Peaks on page 2 (11–20), where a push to page 1 is both plausible and high-value. */
export function strikingDistance(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 0;
  if (position <= 3) return 0.3;   // already top 3 — little upside
  if (position <= 10) return 0.75; // page 1, lower half
  if (position <= 20) return 1.0;  // page 2 — prime striking distance
  if (position <= 30) return 0.5;
  if (position <= 50) return 0.2;
  return 0.05;
}

/** log scale on impressions: ~10k impressions saturates to 1.0. */
export function trafficWeight(impressions: number): number {
  if (!Number.isFinite(impressions) || impressions <= 0) return 0;
  return Math.min(1, Math.log10(impressions + 1) / 4);
}

/** Urgency from recent slippage; extra weight when a page fell off page 1. */
export function movementBoost(position: number, previousPosition: number | null): number {
  if (previousPosition == null) return 0;
  const drop = position - previousPosition; // positive = worse
  let boost = drop > 1 ? Math.min(0.3, drop / 20) : 0;
  if (previousPosition <= 10 && position > 10) boost += 0.25; // fell off page 1
  return Math.min(0.5, boost);
}

/** 0–10 opportunity score; higher = optimise sooner. */
export function opportunityScore(input: ScoreInput): number {
  const striking = strikingDistance(input.position);
  const traffic = trafficWeight(input.impressions);
  const movement = Math.min(1, movementBoost(input.position, input.previousPosition) * 2);
  const core = W_STRIKING * striking + W_TRAFFIC * traffic + W_MOVEMENT * movement;
  return Math.round(core * 1000) / 100; // 0..10, two decimals
}

/** Map a 0–10 opportunity score onto the domain_recommendations priority buckets. */
export function priorityFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

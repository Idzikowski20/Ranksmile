/**
 * Opportunity score for the `optimize` recommendation type — a pure, testable model of
 * Surfer's Content Audit prioritisation, fitted to Surfer's live scores for prodetektyw.pl.
 *
 * Evidence (Surfer recommendation__list, optimize items): the score rises monotonically with
 * the current position across the striking-distance band — deeper in 4–20 (closer to 20)
 * scores higher, because it has the most room to climb to page 1. A recent drop is NOT a
 * positive factor: a page that slipped 11.7→19.4 scored slightly *below* one that held at
 * 19.3. So the model is position-in-striking-distance first, traffic as the tiebreaker;
 * movement is carried on the recommendation for context but not scored.
 */

export interface ScoreInput {
  position: number;
  /** Kept for context on the recommendation (prev-week position); not part of the score. */
  previousPosition: number | null;
  impressions: number;
}

const W_STRIKING = 0.7;
const W_TRAFFIC = 0.3;

/**
 * Striking distance, rising with position inside the 4–20 band (deeper = more upside), the
 * way Surfer's scores do. Near-zero for already-top pages (≤3, little to gain) and for pages
 * too deep to be a cheap win (>30).
 */
export function strikingDistance(position: number): number {
  if (!Number.isFinite(position) || position <= 0) return 0;
  if (position <= 3) return 0.25;                       // already top — little upside
  if (position <= 20) return 0.55 + ((position - 4) / 16) * 0.45; // 4→0.55 … 20→1.0
  if (position <= 30) return 0.5 - ((position - 20) / 10) * 0.25;  // 20→0.5 … 30→0.25
  if (position <= 50) return 0.15;
  return 0.05;
}

/** log scale on impressions: ~10k impressions saturates to 1.0. Cross-position tiebreaker. */
export function trafficWeight(impressions: number): number {
  if (!Number.isFinite(impressions) || impressions <= 0) return 0;
  return Math.min(1, Math.log10(impressions + 1) / 4);
}

/** 0–10 opportunity score; higher = optimise sooner. */
export function opportunityScore(input: ScoreInput): number {
  const striking = strikingDistance(input.position);
  const traffic = trafficWeight(input.impressions);
  const core = W_STRIKING * striking + W_TRAFFIC * traffic;
  return Math.round(core * 1000) / 100; // 0..10, two decimals
}

/** Map a 0–10 opportunity score onto the domain_recommendations priority buckets. */
export function priorityFromScore(score: number): 'high' | 'medium' | 'low' {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

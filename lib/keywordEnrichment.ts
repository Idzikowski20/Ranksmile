/** Simple word-overlap relevance: fraction of keyword words (len > 2) found in target */
export function computeRelevanceScore(keyword: string, targetKeyword: string): number {
  const kwWords = keyword.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const targetWords = new Set(targetKeyword.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  if (kwWords.length === 0 || targetWords.size === 0) return 0;
  const overlap = kwWords.filter(w => targetWords.has(w)).length;
  return overlap / kwWords.length;
}

/** Composite opportunity score 0-1. Higher = more growth potential. */
export function computeOpportunityScore(kw: {
  gsc_position: number | null;
  ads_monthly_volume: number | null;
  ads_competition: string | null;
  is_covered: boolean;
}): number {
  let score = 0.3;

  // Position: weak position = more room to grow (1 = already winning, 50 = huge gap)
  if (kw.gsc_position !== null) {
    score += (Math.min(kw.gsc_position, 50) / 50) * 0.2 - 0.1;
  }

  // Volume: high volume = better opportunity
  if (kw.ads_monthly_volume !== null) {
    score += (Math.min(kw.ads_monthly_volume, 10000) / 10000) * 0.25;
  }

  // Competition: LOW is best, HIGH is worst
  if (kw.ads_competition === 'LOW') score += 0.15;
  else if (kw.ads_competition === 'HIGH') score -= 0.1;

  // Coverage: uncovered = more opportunity to grow
  if (kw.is_covered) score -= 0.1;
  else score += 0.2;

  return Math.min(1, Math.max(0, score));
}

/** Check if keyword text appears in article plain text */
export function checkCoverage(keyword: string, plainText: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i').test(plainText);
}

/** Map Ads competition string to a weight for scoring */
export function competitionWeight(competition: string | null): number {
  if (competition === 'LOW') return 0.2;
  if (competition === 'MEDIUM') return 0.5;
  if (competition === 'HIGH') return 0.8;
  return 0.5;
}

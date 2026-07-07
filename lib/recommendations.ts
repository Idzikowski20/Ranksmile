export type RecFilterable = { type?: string | null; score?: number | null };

/** Drop optimize recs with a 0/missing score — shared by dashboard, nav, and sidebar badges. */
export function isActionableRecommendation(r: RecFilterable): boolean {
  const isOptimize = r.type === 'optimize' || r.score != null;
  return !isOptimize || (r.score ?? 0) > 0;
}

export function countActionableRecommendations(recs: RecFilterable[]): number {
  return recs.filter(isActionableRecommendation).length;
}

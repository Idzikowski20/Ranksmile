export type RecFilterable = { type?: string | null; score?: number | null };

/**
 * Drop optimize recs with a 0/missing score — shared by dashboard, nav, and sidebar badges.
 *
 * The `!isOptimize` branch is deliberate and counts `type='create'` rows: those are real
 * suggestions and the Recommendations page surfaces them in its Content Ideas tab. Keep
 * the two in step — while `create` rows reached no tab at all, this badge was promising
 * work the page then refused to show.
 */
export function isActionableRecommendation(r: RecFilterable): boolean {
  const isOptimize = r.type === 'optimize' || r.score != null;
  return !isOptimize || (r.score ?? 0) > 0;
}

export function countActionableRecommendations(recs: RecFilterable[]): number {
  return recs.filter(isActionableRecommendation).length;
}

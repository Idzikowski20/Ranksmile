import type { ISnapshotRepository } from '../../domain/gsc/snapshotRepository';
import { shiftWeek, weekStartFor } from '../../domain/gsc/week';
import { opportunityScore } from '../../domain/recommendations/opportunityScore';
import type { OptimizeRecommendation } from '../../domain/recommendations/types';

/**
 * Use-case: rank a domain's existing pages by how much re-optimising them is worth, from the
 * same weekly GSC snapshots getWeeklyDrops reads. Returns Surfer-style `optimize`
 * recommendations, best opportunity first. Page → keyword/article enrichment is left to the
 * composition/API layer so this stays a pure GSC read.
 */
export async function getOptimizeRecommendations(
  repo: ISnapshotRepository,
  domainId: number,
  now: Date = new Date(),
  opts: { limit?: number } = {},
): Promise<OptimizeRecommendation[]> {
  const thisWeek = weekStartFor(now);
  const lastWeek = shiftWeek(thisWeek, -1);
  const [current, previous] = await Promise.all([
    repo.getSnapshot(domainId, thisWeek),
    repo.getSnapshot(domainId, lastWeek),
  ]);

  const recs: OptimizeRecommendation[] = [];
  for (const [page, snap] of current) {
    if (snap.impressions <= 0) continue; // no visibility yet — nothing to optimise toward
    const prev = previous.get(page) ?? null;
    const score = opportunityScore({
      position: snap.position,
      previousPosition: prev ? prev.position : null,
      impressions: snap.impressions,
    });
    if (score <= 0) continue;
    recs.push({
      type: 'optimize',
      page,
      currentPosition: Math.round(snap.position * 10) / 10,
      previousPosition: prev ? Math.round(prev.position * 10) / 10 : null,
      impressions: snap.impressions,
      clicks: snap.clicks,
      ctr: snap.impressions > 0 ? Math.round((snap.clicks / snap.impressions) * 1000) / 1000 : 0,
      score,
    });
  }

  recs.sort((a, b) => b.score - a.score);
  return recs.slice(0, opts.limit ?? 25);
}

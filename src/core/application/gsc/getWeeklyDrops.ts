import { computeDrops, type DropResult } from '../../domain/gsc/drops';
import { shiftWeek, weekStartFor } from '../../domain/gsc/week';
import type { ISnapshotRepository } from '../../domain/gsc/snapshotRepository';

/** DropResult plus whether a previous-week baseline existed to compare against. */
export type WeeklyDrops = DropResult & { hadBaseline: boolean };

/**
 * Use-case: compare a domain's most-recent full week of GSC snapshots to the
 * previous week and bucket the position changes. Previously hand-duplicated in
 * pages/api/cron/daily.ts and pages/api/gsc/traffic-alerts.ts.
 */
export async function getWeeklyDrops(
  repo: ISnapshotRepository,
  domainId: number,
  now: Date = new Date(),
): Promise<WeeklyDrops> {
  const thisWeek = weekStartFor(now);
  const lastWeek = shiftWeek(thisWeek, -1);
  const [current, previous] = await Promise.all([
    repo.getSnapshot(domainId, thisWeek),
    repo.getSnapshot(domainId, lastWeek),
  ]);
  return { ...computeDrops(current, previous), hadBaseline: previous.size > 0 };
}

import { getWeeklyDrops as useCase, type WeeklyDrops } from '../core/application/gsc/getWeeklyDrops';
import { createSnapshotRepository } from '../infrastructure/gsc/snapshotRepository';

/** Composition root for GSC — wires the snapshot repository into the use-case. */
export function getWeeklyDrops(domainId: number, now?: Date): Promise<WeeklyDrops> {
  return useCase(createSnapshotRepository(), domainId, now);
}

import { getSnapshot } from '@/src/infrastructure/gsc/gscSnapshots';
import type { ISnapshotRepository } from '../../core/domain/gsc/snapshotRepository';

/**
 * DB-backed ISnapshotRepository. Delegates to lib/gsc/gscSnapshots (Sequelize)
 * for now; that read moves fully under src/infrastructure in the later
 * "lib/ infrastructure extraction" phase.
 */
export function createSnapshotRepository(): ISnapshotRepository {
  return {
    getSnapshot: (domainId, weekStart) => getSnapshot(domainId, weekStart),
  };
}

import type { SnapMap } from './drops';

/**
 * Port for reading a domain's weekly GSC page snapshots. The application layer
 * depends on this interface; the DB-backed implementation lives in
 * src/infrastructure/gsc/snapshotRepository.ts.
 */
export interface ISnapshotRepository {
  getSnapshot(domainId: number, weekStart: string): Promise<SnapMap>;
}

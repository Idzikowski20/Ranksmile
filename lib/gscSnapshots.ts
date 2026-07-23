import db from '../database/database';
import { readLocalSCData } from '../utils/searchConsole';
import { ensureGscSnapshotTables } from './ensureGscSnapshotTables';
import { aggregateSevenDays } from './gscWeek';
import type { SnapMap } from './gscDrops';

// Re-export the pure week helpers so callers (cron, badge API) have one import surface.
export { weekStartFor, shiftWeek, aggregateSevenDays } from './gscWeek';

type RawItem = { page: string; clicks: number; impressions: number; position: number };

/** Read GSC JSON for the domain, aggregate `sevenDays`, and upsert one snapshot row per page. */
export async function captureWeeklySnapshot(domain: string, domainId: number, weekStart: string): Promise<number> {
   await ensureGscSnapshotTables();
   const sc = await readLocalSCData(domain);
   if (!sc || !Array.isArray(sc.sevenDays) || sc.sevenDays.length === 0) return 0;
   const agg = aggregateSevenDays(sc.sevenDays as RawItem[]);
   // Idempotent: clear this domain+week then insert (dialect-agnostic; mirrors lib/wpConnection.ts).
   await db.query('DELETE FROM gsc_page_snapshots WHERE domain_id = ? AND week_start = ?', { replacements: [domainId, weekStart] }).catch(() => {});
   const rows = [...agg];
   const CHUNK = 500;
   for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const replacements: Array<string | number> = [];
      for (const [page, s] of batch) {
         replacements.push(domainId, page, weekStart, Math.round(s.clicks), Math.round(s.impressions), s.position);
      }
      await db.query(
         `INSERT INTO gsc_page_snapshots (domain_id, page, week_start, clicks, impressions, position) VALUES ${placeholders}`,
         { replacements },
      );
   }

   try {
      const { emitObservations, observationsFromGscLowCtr } = await import('./emitObservations');
      const pageRows = rows.map(([page, s]) => ({
         page,
         impressions: Math.round(s.impressions),
         clicks: Math.round(s.clicks),
         position: s.position,
      }));
      await emitObservations(observationsFromGscLowCtr(pageRows, { domainId }), { domainId });
   } catch {
      /* non-fatal */
   }

   return rows.length;
}

/** Load a week's snapshot for a domain as a page -> PageSnap map. */
export async function getSnapshot(domainId: number, weekStart: string): Promise<SnapMap> {
   await ensureGscSnapshotTables();
   const [rows] = await db.query(
      'SELECT page, clicks, impressions, position FROM gsc_page_snapshots WHERE domain_id = ? AND week_start = ?',
      { replacements: [domainId, weekStart] },
   );
   const out: SnapMap = new Map();
   for (const r of rows as Array<{ page: string; clicks: number; impressions: number; position: number }>) {
      out.set(r.page, { clicks: r.clicks, impressions: r.impressions, position: r.position });
   }
   return out;
}

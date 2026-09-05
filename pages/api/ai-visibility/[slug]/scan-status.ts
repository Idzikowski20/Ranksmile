import type { NextApiRequest, NextApiResponse } from 'next';
import { ensureAiVisibilityTables } from '@/src/infrastructure/persistence/schema/ensureAiVisibilityTables';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';
import { parseDbTimestamp } from '@/src/infrastructure/db/timestamps';
import { withOrgPaymentAccess } from '@/src/infrastructure/billing/requireOrgPaymentAccess';
import db from '../../../../database/database';
import verifyUser from '../../../../utils/verifyUser';
import { getCurrentUserId } from '../../../../utils/getUser';
import { verifyDomainOwnershipBySlug } from '../../../../utils/verifyDomainOwnership';

type ScanRow = {
   id: number, status: string, progress_done: number, progress_total: number, cost_micros: number,
   finished_at: string | null, sources_done_at: string | null, profiles_done_at: string | null,
};
/** Counts for the follow-on phases the progress bar reports (sources → brands → profiles). */
type PhaseRow = { sources_total: number, sources_read: number, brands_pending: number, profiles_built: number };

/**
 * How long a phase may show no activity before we stop treating it as live work.
 *
 * Measured from the phase's OWN last write, not from when the scan finished. Keyed off the
 * scan, this killed the polling mid-phase: reading 176 pages legitimately runs for far
 * longer than any scan-relative window, so the UI stopped refreshing while the worker was
 * still fetching, and only a manual reload showed the new count.
 */
const PHASE_GRACE_MS = 5 * 60 * 1000;

/**
 * A phase reports two independent things, and conflating them made the bar lie.
 *
 * `done` is evidence the work happened: the phase's own marker, or counts that prove it.
 * `pending` is only whether to keep polling — it also goes false once the scan is old
 * enough that no worker is coming. A scan whose phases never ran then stops being polled
 * while still, correctly, not showing a tick.
 */
export function phaseState(
   doneAt: unknown,
   countsComplete: boolean,
   finishedAt: unknown,
   /** The phase's own most recent write, when it has made any. */
   lastActivityAt?: unknown,
): { done: boolean; pending: boolean } {
   const done = Boolean(doneAt) || countsComplete;
   if (done) return { done: true, pending: false };
   // A phase that wrote something recently has a worker on it, however old the scan is.
   // Only with nothing recent to go on does the scan's own age decide.
   const since = parseDbTimestamp(lastActivityAt);
   const reference = Number.isFinite(since) ? since : parseDbTimestamp(finishedAt);
   const abandoned = Number.isFinite(reference) && Date.now() - reference > PHASE_GRACE_MS;
   return { done: false, pending: !abandoned };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
   await db.sync();
   await ensureAiVisibilityTables();
   const authorized = await verifyUser(req, res);
   if (authorized !== 'authorized') return res.status(401).json({ error: authorized });
   if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed' }); }
   const userId = await getCurrentUserId(req, res);
   const ownership = await verifyDomainOwnershipBySlug(req.query.slug as string, userId);
   if (ownership === false) return res.status(403).json({ error: 'Access denied.' });
   if (ownership === null) return res.status(404).json({ error: 'Domain not found' });
   const domainId = (ownership as unknown as { ID: number }).ID;

   const scan = await queryOne<ScanRow>(
      `SELECT s.id, s.status, s.progress_done, s.progress_total, s.cost_micros, s.finished_at,
              s.sources_done_at, s.profiles_done_at
       FROM ai_vis_scans s JOIN ai_vis_configs c ON c.id = s.config_id
       WHERE c.domain_id = ? ORDER BY s.id DESC LIMIT 1`,
      [domainId],
   );
   if (!scan) {
      return res.status(200).json({
         status: 'idle', progressDone: 0, progressTotal: 0, costUsd: 0, finishedAt: null,
         sourcesTotal: 0, sourcesRead: 0, brandsPending: 0, profilesBuilt: 0,
         sourcesPending: false, profilesPending: false, sourcesDone: false, profilesDone: false,
         models: [], recentSourceDomains: [],
      });
   }

   // The follow-on phases have no column on the scan row — they are the state of their own
   // tables, so the counters are read from there. One round trip, all counts scalar.
   const phases = await queryOne<PhaseRow>(
      `SELECT
         (SELECT COUNT(*) FROM ai_vis_sources x WHERE x.scan_id = ?) AS sources_total,
         (SELECT COUNT(*) FROM ai_vis_sources x WHERE x.scan_id = ? AND x.fetched_at IS NOT NULL) AS sources_read,
         (SELECT COUNT(*) FROM ai_vis_results r WHERE r.scan_id = ? AND r.brands IS NULL AND r.error IS NULL AND r.answer IS NOT NULL) AS brands_pending,
         (SELECT COUNT(*) FROM ai_vis_brand_profiles p WHERE p.scan_id = ?) AS profiles_built`,
      [scan.id, scan.id, scan.id, scan.id],
   );

   const sourcesTotal = Number(phases?.sources_total ?? 0);
   const sourcesRead = Number(phases?.sources_read ?? 0);

   // Which engines this scan is actually querying, and the pages it has just read — the
   // progress bar shows an icon per engine and a favicon trail, so a phase in flight names
   // what it is working on instead of only counting.
   const modelRows = await queryRows<{ model: string }>(
      'SELECT DISTINCT model FROM ai_vis_results WHERE scan_id = ? ORDER BY model',
      [scan.id],
   ).catch(() => []);
   // Newest first: the trail should read as "just did these", and the bar shows a handful.
   const domainRows = await queryRows<{ domain: string }>(
      `SELECT domain FROM ai_vis_sources
       WHERE scan_id = ? AND fetched_at IS NOT NULL AND domain <> ''
       ORDER BY fetched_at DESC LIMIT 12`,
      [scan.id],
   ).catch(() => []);
   const recentSourceDomains = Array.from(new Set(domainRows.map((r) => r.domain))).slice(0, 6);

   // Each phase's own last write: proof a worker is on it while the counters climb.
   const activity = await queryOne<{ sources_last: string | null; profiles_last: string | null }>(
      `SELECT
         (SELECT MAX(fetched_at) FROM ai_vis_sources WHERE scan_id = ?) AS sources_last,
         (SELECT MAX(updated_at) FROM ai_vis_brand_profiles WHERE scan_id = ?) AS profiles_last`,
      [scan.id, scan.id],
   ).catch(() => null);

   const sources = phaseState(
      scan.sources_done_at,
      sourcesTotal > 0 && sourcesRead >= sourcesTotal,
      scan.finished_at,
      activity?.sources_last,
   );
   const profiles = phaseState(scan.profiles_done_at, false, scan.finished_at, activity?.profiles_last);

   return res.status(200).json({
      status: scan.status,
      progressDone: scan.progress_done || 0,
      progressTotal: scan.progress_total || 0,
      costUsd: (scan.cost_micros || 0) / 1e6, // integer micros → USD at the boundary
      finishedAt: scan.finished_at,
      sourcesTotal,
      sourcesRead,
      models: modelRows.map((r) => r.model),
      recentSourceDomains,
      brandsPending: Number(phases?.brands_pending ?? 0),
      profilesBuilt: Number(phases?.profiles_built ?? 0),
      // Row counts cannot say "finished": a scan that cited nothing, or named no brands,
      // has zero rows for the same reason a scan that has not started does. The phase
      // writes a marker when it drains, and that is the primary completion signal; counts
      // that already prove completion cover rows written before the markers existed.
      sourcesPending: sources.pending,
      sourcesDone: sources.done,
      // No count fallback for profiles: rows written prove the phase STARTED, not that
      // every brand was stored, and calling it done mid-chunk would present a truncated
      // competitor list as final.
      profilesPending: profiles.pending,
      profilesDone: profiles.done,
   });
}

export default withOrgPaymentAccess(handler);

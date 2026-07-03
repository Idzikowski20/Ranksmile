/** DB → overview snapshot. Thin wrapper so the read API and the /history + delta
 *  paths all turn a scanId into a comparable snapshot the same way. Pure mapping
 *  helpers (parseCitations, mapDbRowsToResultRows) are exported for unit tests. */
import { queryRows } from './db/query';
import { buildSnapshot, ResultRow, OverviewSnapshot } from './aiVisibilityMetrics';
import type { LlmCitation } from './dataforseoLlm';

export type DbResultRow = {
   prompt_id: number; model: string; own_cited: number; own_position: number | null; citations: unknown;
};

export const parseCitations = (raw: unknown): LlmCitation[] => {
   // The citations column is jsonb on Postgres → node-pg returns it ALREADY parsed
   // (an array); on SQLite (dev) it's TEXT → a JSON string. Running JSON.parse on an
   // array throws → dropped every citation, so Sources/Competitors came back empty
   // on Neon. Handle both shapes.
   let v: unknown = raw;
   if (typeof raw === 'string') {
      try { v = JSON.parse(raw); } catch { return []; }
   }
   if (!Array.isArray(v)) return [];
   // Coerce every field to a string: a stored citation with a url but missing
   // title/domain must not yield `undefined` (norm(domain) would throw downstream).
   return v
      .filter((c): c is { url: string, domain?: unknown, title?: unknown } => !!c && typeof (c as { url?: unknown }).url === 'string')
      .map((c) => ({ url: c.url, domain: typeof c.domain === 'string' ? c.domain : '', title: typeof c.title === 'string' ? c.title : '' }));
};

export const mapDbRowsToResultRows = (dbRows: DbResultRow[]): ResultRow[] => dbRows.map((r) => ({
   promptId: r.prompt_id,
   model: r.model,
   ownCited: !!r.own_cited,
   ownPosition: r.own_position,
   citations: parseCitations(r.citations),
}));

export async function loadScanResultRows(scanId: number): Promise<ResultRow[]> {
   const dbRows = await queryRows<DbResultRow>(
      `SELECT prompt_id, model, own_cited, own_position, citations
       FROM ai_vis_results WHERE scan_id = ? AND error IS NULL`,
      [scanId],
   );
   return mapDbRowsToResultRows(dbRows);
}

export async function buildOverview(scanId: number): Promise<OverviewSnapshot> {
   return buildSnapshot(await loadScanResultRows(scanId));
}

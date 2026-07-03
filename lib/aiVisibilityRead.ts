/** DB → overview snapshot. Thin wrapper so the read API and the /history + delta
 *  paths all turn a scanId into a comparable snapshot the same way. Pure mapping
 *  helpers (parseCitations, mapDbRowsToResultRows) are exported for unit tests. */
import { queryRows } from './db/query';
import { buildSnapshot, ResultRow, OverviewSnapshot } from './aiVisibilityMetrics';
import type { LlmCitation } from './dataforseoLlm';

export type DbResultRow = {
   prompt_id: number; model: string; own_cited: number; own_position: number | null; citations: string | null;
};

export const parseCitations = (raw: string | null): LlmCitation[] => {
   if (!raw) return [];
   try {
      const v = JSON.parse(raw);
      if (!Array.isArray(v)) return [];
      // Coerce every field to a string: a stored citation with a url but missing
      // title/domain must not yield `undefined` (norm(domain) would throw downstream).
      return v
         .filter((c): c is { url: string, domain?: unknown, title?: unknown } => !!c && typeof c.url === 'string')
         .map((c) => ({ url: c.url, domain: typeof c.domain === 'string' ? c.domain : '', title: typeof c.title === 'string' ? c.title : '' }));
   } catch { return []; }
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

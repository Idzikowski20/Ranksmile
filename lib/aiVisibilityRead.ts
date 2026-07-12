/** DB → result rows. Thin wrapper so the read API and the /history + delta paths
 *  all load a scan's rows the same way. Pure mapping helpers (parseCitations,
 *  mapDbRowsToResultRows) are exported for unit tests. Rows carry the prompt's
 *  topic/text so snapshotForDomain can compose prompts/topics without re-querying. */
import { queryRows, queryOne } from './db/query';
import { ResultRow, BrandMention } from './aiVisibilityMetrics';
import type { LlmCitation } from './dataforseoLlm';

export type DbResultRow = {
   prompt_id: number; model: string; own_cited: number; own_position: number | null;
   citations: unknown; topic: string | null; text: string | null; brands: unknown; fan_out_queries?: unknown;
};

/** fan_out_queries column: jsonb (parsed array) on Postgres, TEXT (JSON string) on
 *  SQLite — handle both like parseCitations; keep only non-empty strings. */
export const parseFanOut = (raw: unknown): string[] => {
   let v: unknown = raw;
   if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return []; } }
   if (!Array.isArray(v)) return [];
   return v.filter((q): q is string => typeof q === 'string').map((q) => q.trim()).filter(Boolean);
};

/** brands column: jsonb (parsed array) on Postgres, TEXT (JSON string) on SQLite —
 *  handle both, like parseCitations. pos = the stored array order (appearance order). */
export const parseBrands = (raw: unknown): BrandMention[] => {
   let v: unknown = raw;
   if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return []; } }
   if (!Array.isArray(v)) return [];
   return v
      .filter((b): b is { brand: string } & Record<string, unknown> => !!b && typeof (b as { brand?: unknown }).brand === 'string')
      .map((b, i) => ({
         brand: String(b.brand),
         domain: typeof b.domain === 'string' ? b.domain : '',
         sentiment: (['positive', 'neutral', 'negative', 'mixed'].includes(String(b.sentiment)) ? b.sentiment : 'neutral') as BrandMention['sentiment'],
         pos: i + 1,
         quotes: Array.isArray(b.quotes) ? b.quotes.filter((q): q is string => typeof q === 'string').slice(0, 3) : [],
      }));
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
   topic: r.topic ?? '',
   text: r.text ?? '',
   brands: parseBrands(r.brands),
   fanOutQueries: parseFanOut(r.fan_out_queries),
}));

export async function loadScanResultRows(scanId: number): Promise<ResultRow[]> {
   const dbRows = await queryRows<DbResultRow>(
      // LEFT JOIN: a prompt config edit can DELETE a prompt (reconciliation), leaving
      // historical ai_vis_results rows that reference a now-missing prompt id. An inner
      // join would silently drop those rows and corrupt past scan metrics; LEFT JOIN keeps
      // every result row and just leaves topic/text NULL (mapDbRowsToResultRows → '').
      `SELECT r.prompt_id, r.model, r.own_cited, r.own_position, r.citations, r.brands, r.fan_out_queries, p.topic, p.text
       FROM ai_vis_results r LEFT JOIN ai_vis_prompts p ON p.id = r.prompt_id
       WHERE r.scan_id = ? AND r.error IS NULL`,
      [scanId],
   );
   return mapDbRowsToResultRows(dbRows);
}

async function queryCompletedScan(
   domainId: number,
   opts: { requireUsableRows?: boolean; beforeFinishedAt?: string } = {},
): Promise<{ id: number; finished_at: string | null } | null> {
   const filters = ['c.domain_id = ?', "s.status = 'completed'"];
   const params: unknown[] = [domainId];
   if (opts.beforeFinishedAt) {
      filters.push('s.finished_at < ?');
      params.push(opts.beforeFinishedAt);
   }
   if (opts.requireUsableRows) {
      filters.push('EXISTS (SELECT 1 FROM ai_vis_results r WHERE r.scan_id = s.id AND r.error IS NULL)');
   }
   return queryOne<{ id: number; finished_at: string | null }>(
      `SELECT s.id, s.finished_at FROM ai_vis_scans s
       JOIN ai_vis_configs c ON c.id = s.config_id
       WHERE ${filters.join(' AND ')}
       ORDER BY s.finished_at DESC LIMIT 1`,
      params,
   );
}

/** Latest completed scan for a domain, even when every row failed (e.g. DFS 402). */
export async function getLatestCompletedScan(
   domainId: number,
): Promise<{ id: number; finished_at: string | null } | null> {
   return queryCompletedScan(domainId);
}

/** Scan to show in the UI: newest completed scan with at least one successful result row. */
export async function getDisplayScan(domainId: number): Promise<{
   scan: { id: number; finished_at: string | null };
   usingFallbackScan: boolean;
   latestAttemptFinishedAt: string | null;
} | null> {
   const latest = await getLatestCompletedScan(domainId);
   if (!latest) return null;

   const usable = await queryCompletedScan(domainId, { requireUsableRows: true });
   if (!usable) return null;

   return {
      scan: usable,
      usingFallbackScan: usable.id !== latest.id,
      latestAttemptFinishedAt: latest.finished_at,
   };
}

/** Previous display scan (for delta), chronologically before `beforeFinishedAt`. */
export async function getPreviousDisplayScan(
   domainId: number,
   beforeFinishedAt: string,
): Promise<{ id: number; finished_at: string | null } | null> {
   return queryCompletedScan(domainId, { requireUsableRows: true, beforeFinishedAt });
}

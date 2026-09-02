/**
 * "Reading sources" phase — fetch every page the AI answers cited, once per scan.
 *
 * The answers hand us a URL and whatever title the model claimed; that is not evidence.
 * This phase visits each cited page and records what is actually there: the real <title>,
 * the HTTP status (a dead citation is worth knowing), and whether the page mentions our
 * brand. The reference tool reports the same per-source shape — url, a `mentioned` flag
 * and a reference count — so Sources can show verified rows instead of claims.
 *
 * Chunked and resumable, mirroring runScanChunk/runBrandChunk: the sidecar drains it over
 * ticks so a 250-source scan never blocks a request.
 */
import db from '@/database/database';
import { ssrfSafeFetch } from '@/src/infrastructure/http/ssrfGuard';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';

export type SourceChunkResult = { done: number; remaining: number };
export const AI_VIS_SOURCE_CHUNK = 8;

const norm = (d: string): string => d.toLowerCase().replace(/^www\./, '');

/** citations column: JSONB (parsed) on Postgres, TEXT on SQLite — accept both. */
function parseCitationUrls(raw: unknown): Array<{ url: string; domain: string }> {
   let v: unknown = raw;
   if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return []; } }
   if (!Array.isArray(v)) return [];
   const out: Array<{ url: string; domain: string }> = [];
   for (const c of v) {
      const url = (c as { url?: unknown })?.url;
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) continue;
      let domain = String((c as { domain?: unknown })?.domain ?? '');
      if (!domain) { try { domain = new URL(url).hostname; } catch { continue; } }
      out.push({ url, domain: norm(domain) });
   }
   return out;
}

/** Queue the scan's distinct cited URLs. Idempotent — the unique index is the real guard. */
async function seedSources(scanId: number): Promise<void> {
   const rows = await queryRows<{ citations: unknown }>(
      'SELECT citations FROM ai_vis_results WHERE scan_id = ?',
      [scanId],
   );
   const byUrl = new Map<string, string>();
   for (const r of rows) for (const c of parseCitationUrls(r.citations)) if (!byUrl.has(c.url)) byUrl.set(c.url, c.domain);
   if (!byUrl.size) return;

   const existing = await queryRows<{ url: string }>('SELECT url FROM ai_vis_sources WHERE scan_id = ?', [scanId]);
   const have = new Set(existing.map((r) => r.url));
   for (const [url, domain] of byUrl) {
      if (have.has(url)) continue;
      await db.query(
         'INSERT INTO ai_vis_sources (scan_id, url, domain) VALUES (?, ?, ?)',
         { replacements: [scanId, url, domain] },
      ).catch(() => {});
   }
}

/** Real <title>, collapsed and trimmed. Empty when the page has none. */
function extractTitle(html: string): string {
   const m = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html);
   return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 200) : '';
}

/**
 * Fetch up to `limit` un-read sources of a scan.
 *
 * A failed fetch still marks the row read (with whatever status came back) — otherwise one
 * unreachable host stalls the phase forever, and "we tried and it was dead" is the answer.
 */
export async function runSourceChunk(
   scanId: number,
   ownBrand: string,
   ownDomain: string,
   limit = AI_VIS_SOURCE_CHUNK,
): Promise<SourceChunkResult> {
   await seedSources(scanId);

   const pending = await queryRows<{ id: number; url: string; domain: string }>(
      'SELECT id, url, domain FROM ai_vis_sources WHERE scan_id = ? AND fetched_at IS NULL ORDER BY id LIMIT ?',
      [scanId, limit],
   );

   const brand = ownBrand.trim().toLowerCase();
   const own = norm(ownDomain);

   for (const row of pending) {
      let title = '';
      let status: number | null = null;
      let mentioned = norm(row.domain) === own; // our own page always counts
      try {
         // eslint-disable-next-line no-await-in-loop -- sequential on purpose: one chunk is a
         // handful of third-party fetches; parallelising them would hammer small hosts.
         const res = await ssrfSafeFetch(row.url, { headers: { Accept: 'text/html,*/*;q=0.8' } });
         status = res.status;
         if (res.ok) {
            // eslint-disable-next-line no-await-in-loop
            const html = (await res.text()).slice(0, 200_000);
            title = extractTitle(html);
            if (!mentioned && brand) mentioned = html.toLowerCase().includes(brand);
         }
      } catch {
         status = null; // unreachable / blocked / timed out — still recorded as read
      }
      // eslint-disable-next-line no-await-in-loop
      await db.query(
         'UPDATE ai_vis_sources SET title = ?, http_status = ?, own_mentioned = ?, fetched_at = CURRENT_TIMESTAMP WHERE id = ?',
         { replacements: [title || null, status, mentioned ? 1 : 0, row.id] },
      ).catch(() => {});
   }

   const left = await queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM ai_vis_sources WHERE scan_id = ? AND fetched_at IS NULL',
      [scanId],
   );
   return { done: pending.length, remaining: Number(left?.n ?? 0) };
}

/** Latest completed scan per config whose cited pages are not all read yet. */
export async function findScansNeedingSources(limit = 5): Promise<Array<{ scanId: number; brandName: string; domain: string }>> {
   return queryRows<{ scanId: number; brandName: string; domain: string }>(
      `SELECT s.id AS "scanId", c.brand_name AS "brandName", d.domain AS domain
       FROM ai_vis_scans s
       JOIN ai_vis_configs c ON c.id = s.config_id
       JOIN domain d ON d."ID" = c.domain_id
       JOIN (SELECT config_id, MAX(finished_at) AS mx FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id) latest
         ON latest.config_id = s.config_id AND latest.mx = s.finished_at
       WHERE s.status = 'completed'
         AND EXISTS (SELECT 1 FROM ai_vis_results r WHERE r.scan_id = s.id)
         AND (NOT EXISTS (SELECT 1 FROM ai_vis_sources x WHERE x.scan_id = s.id)
              OR EXISTS (SELECT 1 FROM ai_vis_sources x WHERE x.scan_id = s.id AND x.fetched_at IS NULL))
       ORDER BY s.finished_at DESC LIMIT ?`,
      [limit],
   );
}

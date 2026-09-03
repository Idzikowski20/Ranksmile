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
import { isBlockedCitationDomain } from '@/src/core/domain/aiVisibility/blockedDomains';
import { queryOne, queryRows } from '@/src/infrastructure/db/query';

export type SourceChunkResult = { done: number; remaining: number };
export const AI_VIS_SOURCE_CHUNK = 8;
/** Read at most this much of a page: enough for <title> and a brand mention, bounded so a
 *  hostile or broken host cannot stream us out of memory. */
const MAX_PAGE_BYTES = 200_000;

const norm = (d: string): string => d.toLowerCase().replace(/^www\./, '');

/** citations column: JSONB (parsed) on Postgres, TEXT on SQLite — accept both. */
function parseCitationUrls(raw: unknown): Array<{ url: string; domain: string }> {
   let v: unknown = raw;
   if (typeof raw === 'string') { try { v = JSON.parse(raw); } catch { return []; } }
   if (!Array.isArray(v)) return [];
   const out: Array<{ url: string; domain: string }> = [];
   for (const c of v) {
      const url = (c as { url?: unknown })?.url;
      // https only: an http page is fetched in the clear, and anything on the wire could
      // flip own_mentioned. Such a citation stays unread (Sources shows a dash for it)
      // rather than being recorded on evidence we cannot trust.
      if (typeof url !== 'string' || !/^https:\/\//i.test(url)) continue;
      let domain = String((c as { domain?: unknown })?.domain ?? '');
      if (!domain) { try { domain = new URL(url).hostname; } catch { continue; } }
      // Grounding and redirect proxies are not sources; Sources drops them on read, so
      // queueing them would only spend the fetch budget and inflate this phase's progress.
      if (isBlockedCitationDomain(domain)) continue;
      out.push({ url, domain: norm(domain) });
   }
   return out;
}

/**
 * Queue every cited URL of the scan that is not queued yet. Returns how many it added.
 *
 * Reconciles rather than seeding blind: a scan half-seeded by an earlier build would
 * otherwise keep its missing citations forever, and the phase would mark an incomplete
 * source set as finished.
 */
async function seedSources(scanId: number): Promise<number> {
   const rows = await queryRows<{ citations: unknown }>(
      'SELECT citations FROM ai_vis_results WHERE scan_id = ? AND error IS NULL',
      [scanId],
   );
   const byUrl = new Map<string, string>();
   for (const r of rows) for (const c of parseCitationUrls(r.citations)) if (!byUrl.has(c.url)) byUrl.set(c.url, c.domain);
   if (!byUrl.size) return 0;

   const existing = await queryRows<{ url: string }>('SELECT url FROM ai_vis_sources WHERE scan_id = ?', [scanId]);
   for (const r of existing) byUrl.delete(r.url);
   if (!byUrl.size) return 0;

   // One multi-row INSERT: a 250-source scan used to be 250 round trips. ON CONFLICT so a
   // concurrent tick claiming one URL cannot fail the whole statement.
   const entries = [...byUrl.entries()];
   const values = entries.map(() => '(?, ?, ?)').join(', ');
   const params = entries.flatMap(([url, domain]) => [scanId, url, domain]);
   await db.query(
      `INSERT INTO ai_vis_sources (scan_id, url, domain) VALUES ${values}
       ON CONFLICT (scan_id, url) DO NOTHING`,
      { replacements: params },
   );
   return entries.length;
}

/** Read a response body up to `max` characters, stopping the download at the cap instead
 *  of buffering whatever the host decides to send. */
async function readCapped(res: Response, max: number): Promise<string> {
   const { body } = res;
   if (!body) return (await res.text()).slice(0, max);
   const reader = body.getReader();
   const decoder = new TextDecoder();
   let out = '';
   try {
      for (;;) {
         // eslint-disable-next-line no-await-in-loop -- reading one stream, chunk by chunk.
         const { done, value } = await reader.read();
         if (done) break;
         out += decoder.decode(value, { stream: true });
         if (out.length >= max) break;
      }
   } finally {
      await reader.cancel().catch(() => {});
   }
   return out.slice(0, max);
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
   /** Stop starting new fetches past this moment, so the caller's request cannot outlive
    *  the sidecar's timeout. Rows not reached stay pending for the next tick. */
   deadlineAt = Number.POSITIVE_INFINITY,
): Promise<SourceChunkResult> {
   // Cheap short-circuit: skip the whole-scan citation read while there is still queued
   // work, and reconcile only when the queue looks drained (below), which is the only
   // moment a missed citation could be mistaken for "phase finished".
   const queued = await queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM ai_vis_sources WHERE scan_id = ? AND fetched_at IS NULL',
      [scanId],
   );
   if (!Number(queued?.n ?? 0)) await seedSources(scanId);

   const pending = await queryRows<{ id: number; url: string; domain: string }>(
      'SELECT id, url, domain FROM ai_vis_sources WHERE scan_id = ? AND fetched_at IS NULL ORDER BY id LIMIT ?',
      [scanId, limit],
   );

   const brand = ownBrand.trim().toLowerCase();
   const own = norm(ownDomain);

   let reached = 0;
   for (const row of pending) {
      if (Date.now() >= deadlineAt) break;
      reached += 1;
      let title = '';
      let status: number | null = null;
      let mentioned = norm(row.domain) === own; // our own page always counts
      try {
         // eslint-disable-next-line no-await-in-loop -- sequential on purpose: one chunk is a
         // handful of third-party fetches; parallelising them would hammer small hosts.
         // Bound the whole fetch, redirect hops included, by what is left of the budget:
         // ssrfSafeFetch's own 15s applies per hop, so four hops could run an hour past
         // the deadline the caller set.
         const res = await ssrfSafeFetch(row.url, {
            headers: { Accept: 'text/html,*/*;q=0.8' },
            signal: Number.isFinite(deadlineAt)
               ? AbortSignal.timeout(Math.max(1, deadlineAt - Date.now()))
               : undefined,
         });
         status = res.status;
         if (res.ok) {
            // eslint-disable-next-line no-await-in-loop
            const html = await readCapped(res, MAX_PAGE_BYTES);
            title = extractTitle(html);
            // ponytail: substring match over raw HTML — counts a brand named only in markup
            // or in a URL, misses one written as an entity, and matches inside longer words.
            // Upgrade to text-extracted, entity-decoded, word-boundary matching if this flag
            // ever drives more than the Sources column.
            if (!mentioned && brand) mentioned = html.toLowerCase().includes(brand);
         }
      } catch {
         status = null; // unreachable / blocked / timed out — still recorded as read
         // Unless we simply ran out of budget mid-fetch: that page was never opened, and
         // stamping fetched_at would publish "does not mention your brand" about a page
         // nobody looked at, with no retry. Leave it queued for the next tick.
         if (Number.isFinite(deadlineAt) && Date.now() >= deadlineAt) {
            reached -= 1;
            break;
         }
      }
      // eslint-disable-next-line no-await-in-loop
      await db.query(
         'UPDATE ai_vis_sources SET title = ?, http_status = ?, own_mentioned = ?, fetched_at = CURRENT_TIMESTAMP WHERE id = ?',
         { replacements: [title || null, status, mentioned ? 1 : 0, row.id] },
      );
   }

   const left = await queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM ai_vis_sources WHERE scan_id = ? AND fetched_at IS NULL',
      [scanId],
   );
   let remaining = Number(left?.n ?? 0);
   // Last check before calling the phase done: make sure every citation is queued. A scan
   // seeded by an earlier build can be missing URLs, and marking it finished would lose
   // them permanently.
   if (!remaining) remaining = await seedSources(scanId);
   // Terminal marker. Without it a scan whose answers cited nothing is handed back by the
   // finder forever and the UI never leaves this phase, because "no rows queued" reads
   // exactly like "not started yet".
   if (!remaining) {
      await db.query(
         'UPDATE ai_vis_scans SET sources_done_at = CURRENT_TIMESTAMP WHERE id = ? AND sources_done_at IS NULL',
         { replacements: [scanId] },
      );
   }
   return { done: reached, remaining };
}

/** Latest completed scan per config whose cited pages are not all read yet. */
export async function findScansNeedingSources(limit = 5): Promise<Array<{ scanId: number; brandName: string; domain: string }>> {
   return queryRows<{ scanId: number; brandName: string; domain: string }>(
      `SELECT s.id AS "scanId", COALESCE(s.brand_name, c.brand_name) AS "brandName", d.domain AS domain
       FROM ai_vis_scans s
       JOIN ai_vis_configs c ON c.id = s.config_id
       JOIN domain d ON d."ID" = c.domain_id
       JOIN (SELECT config_id, MAX(finished_at) AS mx FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id) latest
         ON latest.config_id = s.config_id AND latest.mx = s.finished_at
       WHERE s.status = 'completed'
         AND s.sources_done_at IS NULL
         AND EXISTS (SELECT 1 FROM ai_vis_results r WHERE r.scan_id = s.id)
       ORDER BY s.finished_at DESC LIMIT ?`,
      [limit],
   );
}

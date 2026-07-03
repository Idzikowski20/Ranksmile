/**
 * AI Visibility scan runner. Mirrors lib/domainPipeline.ts orchestration and is
 * split into three composable pieces so the trigger can change without touching
 * the work:
 *   enqueueAiVisScan(configId) — write a `queued` row (idempotent per active scan)
 *   claimScan(scanId)          — atomic optimistic lock: queued → running
 *   kickAiVisScan(scanId, dom) — claim, then run all (prompt × model) pairs
 * Today the API route fire-and-forgets kickAiVisScan; migrating to a cron poller,
 * BullMQ worker, or the python-sidecar means calling claim+kick from there instead
 * — no signature changes. Results are per (prompt, model); a failed call is
 * recorded on its own row so one bad prompt never fails the whole scan.
 */
import db from '../database/database';
import { queryOne, queryRows } from './db/query';
import { runModelPrompt, AiModel } from './dataforseoLlm';
import { ownDomainPosition } from './aiVisibilityMetrics';
import { sanitizeModels, AI_VIS_CONCURRENCY, AI_VIS_HARD_CAP_PAIRS, AI_VIS_SCAN_STALE_MS, AI_VIS_SETTINGS } from './aiVisibility';

type Exec = (sql: string, replacements?: unknown[]) => Promise<[unknown[], number]>;

/**
 * Normalise the affected-row count across dialects. Sequelize returns the second
 * tuple element differently per driver: Postgres gives the pg result OBJECT
 * (`{ rowCount }`), MySQL/SQLite give a plain number. `Number(pgResultObject)` is
 * NaN, so reading it directly made claimScan always return false — the scan
 * flipped to `running` but the runner bailed immediately. Read `.rowCount` when
 * present, else coerce the number.
 */
const affectedRows = (out: unknown): number => {
   const meta = Array.isArray(out) ? (out as unknown[])[1] : undefined;
   if (typeof meta === 'number') return meta;
   if (meta && typeof meta === 'object' && 'rowCount' in meta) {
      return Number((meta as { rowCount?: unknown }).rowCount) || 0;
   }
   return 0;
};

const defaultExec: Exec = async (sql, replacements) => {
   const out = await db.query(sql, { replacements });
   return [[], affectedRows(out)];
};

/** Atomic claim — exported for unit tests with a stub executor. */
export async function claimScan(scanId: number, exec: Exec = defaultExec): Promise<boolean> {
   const [, affected] = await exec(
      "UPDATE ai_vis_scans SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'queued'",
      [scanId],
   );
   return Number(affected) > 0;
}

export async function enqueueAiVisScan(configId: number): Promise<number> {
   // Reclaim a dead scan first: without this, a `running` scan killed mid-run
   // (Vercel 60s timeout, crash, deploy) would match the active-check below and
   // block every future scan for this config forever. staleSecs is derived from a
   // constant (not user input) → safe to interpolate. Dialect-specific age math.
   const isPg = !!process.env.DATABASE_URL;
   const staleSecs = Math.floor(AI_VIS_SCAN_STALE_MS / 1000);
   await db.query(
      isPg
         ? `UPDATE ai_vis_scans SET status = 'failed', error = 'stale (reclaimed)', finished_at = NOW()
             WHERE config_id = ? AND status = 'running' AND started_at < NOW() - INTERVAL '${staleSecs} seconds'`
         : `UPDATE ai_vis_scans SET status = 'failed', error = 'stale (reclaimed)', finished_at = CURRENT_TIMESTAMP
             WHERE config_id = ? AND status = 'running' AND started_at < datetime('now', '-${staleSecs} seconds')`,
      { replacements: [configId] },
   ).catch(() => { /* best-effort reclaim; the active-check still guards double-run */ });

   const active = await queryOne<{ id: number }>(
      "SELECT id FROM ai_vis_scans WHERE config_id = ? AND status IN ('queued','running') ORDER BY id DESC LIMIT 1",
      [configId],
   );
   if (active) return active.id;
   await db.query('INSERT INTO ai_vis_scans (config_id, status) VALUES (?, ?)', { replacements: [configId, 'queued'] });
   const created = await queryOne<{ id: number }>(
      'SELECT id FROM ai_vis_scans WHERE config_id = ? ORDER BY id DESC LIMIT 1', [configId],
   );
   if (!created) throw new Error('Failed to enqueue scan');
   return created.id;
}

export type DueSelect = (sql: string, repl: unknown[]) => Promise<Array<{ id: number }>>;
const defaultDueSelect: DueSelect = (sql, repl) => queryRows<{ id: number }>(sql, repl);

/**
 * Configs due for an automatic refresh: their most-recent COMPLETED scan finished
 * more than REFRESH_INTERVAL_DAYS ago AND they have no queued/running scan. Oldest
 * first (ORDER BY last_done ASC), capped at `limit` so one tick can't flood the
 * worker — a backlog of due configs drains a batch per tick (next tick takes the
 * next oldest N). Configs that never completed a scan are excluded (their first
 * scan is user-driven). `run` is injectable for unit tests. Interpolated values
 * are constants, not user input. Dialect-aware date math mirrors enqueueAiVisScan.
 */
export async function findDueConfigIds(limit = AI_VIS_SETTINGS.SCHEDULER_BATCH_LIMIT, run: DueSelect = defaultDueSelect): Promise<number[]> {
   const isPg = !!process.env.DATABASE_URL;
   const days = AI_VIS_SETTINGS.REFRESH_INTERVAL_DAYS;
   const cutoff = isPg ? `NOW() - INTERVAL '${days} days'` : `datetime('now', '-${days} days')`;
   const cap = Number(limit) || AI_VIS_SETTINGS.SCHEDULER_BATCH_LIMIT;
   const rows = await run(
      `SELECT c.id AS id
         FROM ai_vis_configs c
         JOIN (
            SELECT config_id, MAX(finished_at) AS last_done
              FROM ai_vis_scans WHERE status = 'completed' GROUP BY config_id
         ) lc ON lc.config_id = c.id
        WHERE lc.last_done < ${cutoff}
          AND NOT EXISTS (
             SELECT 1 FROM ai_vis_scans a WHERE a.config_id = c.id AND a.status IN ('queued', 'running')
          )
        ORDER BY lc.last_done ASC
        LIMIT ${cap}`,
      [],
   );
   return rows.map((r) => Number(r.id));
}

type PromptRow = { id: number, text: string };
type Pair = { prompt: PromptRow, model: AiModel };

/** Default pairs processed per chunk. Sized so one chunk stays well under any
 *  serverless time limit (~20 pairs / concurrency 3 ≈ 7 waves ≈ 30s). */
export const AI_VIS_CHUNK_PAIRS = 20;

export type ScanChunkResult = { finished: boolean, done: number, total: number };

/** Build the full (prompt × model) work-list for a scan's config, capped. */
async function loadPairs(configId: number): Promise<Pair[]> {
   const cfg = await queryOne<{ models: string | null }>('SELECT models FROM ai_vis_configs WHERE id = ? LIMIT 1', [configId]);
   // sanitizeModels drops anything not in AI_VIS_ALL_MODELS, so a corrupt row
   // (e.g. ["abc"]) can never reach runModelPrompt; falls back to defaults.
   let parsedModels: unknown = null;
   try { parsedModels = cfg?.models ? JSON.parse(cfg.models) : null; } catch { parsedModels = null; }
   const models = sanitizeModels(parsedModels) as AiModel[];
   const prompts = await queryRows<PromptRow>(
      'SELECT id, text FROM ai_vis_prompts WHERE config_id = ? AND selected = 1 ORDER BY sort_order, id',
      [configId],
   );
   return prompts.flatMap((p) => models.map((m) => ({ prompt: p, model: m }))).slice(0, AI_VIS_HARD_CAP_PAIRS);
}

/**
 * Process up to `limit` not-yet-done pairs of a scan, then return. RESUMABLE and
 * idempotent: "done" is derived from the rows already in ai_vis_results, so a
 * chunk that dies mid-run is simply re-driven by the next call — nothing is
 * double-charged. This is the unit the durable worker (python-sidecar) loops over
 * so no single call has to outlast a serverless timeout. Marks the scan
 * `completed` once no pairs remain. Per-pair failures are recorded on their own
 * row and count as done (runModelPrompt already retried transient errors 3×).
 */
export async function runScanChunk(scanId: number, ownDomain: string, limit = AI_VIS_CHUNK_PAIRS): Promise<ScanChunkResult> {
   const scan = await queryOne<{ status: string, config_id: number }>('SELECT status, config_id FROM ai_vis_scans WHERE id = ? LIMIT 1', [scanId]);
   if (!scan) throw new Error('Scan not found');

   const allPairs = await loadPairs(scan.config_id);
   const total = allPairs.length;

   // Terminal already — nothing to do (idempotent for late/duplicate drives).
   if (scan.status === 'completed' || scan.status === 'failed' || scan.status === 'cancelled') {
      return { finished: true, done: total, total };
   }
   // First chunk claims queued→running; later chunks just continue an already-running scan.
   if (scan.status === 'queued') await claimScan(scanId);

   await db.query('UPDATE ai_vis_scans SET progress_total = ? WHERE id = ?', { replacements: [total, scanId] });

   const doneRows = await queryRows<{ prompt_id: number, model: string }>('SELECT prompt_id, model FROM ai_vis_results WHERE scan_id = ?', [scanId]);
   const doneKey = (promptId: number, model: string) => `${promptId}:${model}`;
   const doneSet = new Set(doneRows.map((r) => doneKey(r.prompt_id, r.model)));
   const pending = allPairs.filter((p) => !doneSet.has(doneKey(p.prompt.id, p.model)));

   if (pending.length === 0) {
      await db.query(
         "UPDATE ai_vis_scans SET status = 'completed', progress_done = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
         { replacements: [total, scanId] },
      );
      return { finished: true, done: total, total };
   }

   let done = doneSet.size;
   const queue = pending.slice(0, Math.max(1, limit));
   const worker = async (): Promise<void> => {
      for (;;) {
         const pair = queue.shift();
         if (!pair) return;
         let micros = 0;
         try {
            const out = await runModelPrompt(pair.model, pair.prompt.text, 'PL');
            const pos = ownDomainPosition(out.citations, ownDomain);
            micros = Math.round(out.costUsd * 1e6);
            await db.query(
               `INSERT INTO ai_vis_results (scan_id, prompt_id, model, answer, citations, own_cited, own_position, cost_micros)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
               { replacements: [scanId, pair.prompt.id, pair.model, out.text, JSON.stringify(out.citations), pos ? 1 : 0, pos, micros] },
            );
         } catch (e) {
            await db.query(
               'INSERT INTO ai_vis_results (scan_id, prompt_id, model, error) VALUES (?, ?, ?, ?)',
               { replacements: [scanId, pair.prompt.id, pair.model, String((e as Error)?.message ?? e)] },
            ).catch(() => { /* row-level best effort */ });
         }
         done += 1;
         // Absolute progress_done (from the row count) + incremental cost. Written
         // after EVERY row so the progress bar advances live; a DB write is trivial
         // next to a multi-second model call.
         await db.query('UPDATE ai_vis_scans SET progress_done = ?, cost_micros = cost_micros + ? WHERE id = ?', { replacements: [done, micros, scanId] }).catch(() => {});
      }
   };
   await Promise.all(Array.from({ length: AI_VIS_CONCURRENCY }, worker));

   const finished = done >= total;
   if (finished) {
      await db.query(
         "UPDATE ai_vis_scans SET status = 'completed', progress_done = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
         { replacements: [total, scanId] },
      );
   }
   return { finished, done, total };
}

/**
 * Run a scan to completion inline by looping runScanChunk. Used for local dev
 * (long-lived `next dev` process) and standalone scripts. On serverless the
 * durable path drives runScanChunk one chunk at a time via the sidecar instead.
 */
export async function kickAiVisScan(scanId: number, ownDomain: string): Promise<void> {
   try {
      // Bounded by ceil(total / chunk); the guard only backstops a logic bug.
      for (let i = 0; i < 100000; i += 1) {
         const { finished } = await runScanChunk(scanId, ownDomain);
         if (finished) return;
      }
   } catch (error) {
      await db.query(
         "UPDATE ai_vis_scans SET status = 'failed', error = ?, finished_at = CURRENT_TIMESTAMP WHERE id = ?",
         { replacements: [String((error as Error)?.message ?? error), scanId] },
      ).catch(() => {});
   }
}

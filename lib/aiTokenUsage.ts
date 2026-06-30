import db from '../database/database';
import { queryOne } from './db/query';

// Org-wide AI token budget. Surfy/Auto-Optimize draw from a single per-organization pool that
// refills every 5 hours (fixed buckets). created_ms is stored as epoch milliseconds so the window
// math is pure integers — no timezone/format pitfalls across Postgres and SQLite.
export const AI_TOKEN_LIMIT_5H = 500_000;
export const AI_WINDOW_MS = 5 * 60 * 60 * 1000;

const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

let ready: Promise<void> | null = null;
export function ensureAiTokenUsageTable(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS ai_token_usage (
        id         ${PK},
        org_id     INTEGER NOT NULL,
        tokens     INTEGER NOT NULL,
        created_ms BIGINT NOT NULL
      )`);
      await db.query('CREATE INDEX IF NOT EXISTS idx_ai_token_usage_org_ms ON ai_token_usage (org_id, created_ms)').catch(() => {});
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

/** Start of the current fixed 5h bucket (epoch ms). */
export function windowStart(now = Date.now()): number {
  return Math.floor(now / AI_WINDOW_MS) * AI_WINDOW_MS;
}

export interface OrgUsage { used: number; limit: number; resetsAt: number; over: boolean; }

/** Tokens the org has spent in the current 5h window, the cap, and when it refills. */
export async function getOrgUsage5h(orgId: number | null | undefined): Promise<OrgUsage> {
  const start = windowStart();
  const resetsAt = start + AI_WINDOW_MS;
  let used = 0;
  if (orgId) {
    try {
      await ensureAiTokenUsageTable();
      const row = await queryOne<{ used: number | string }>(
        'SELECT COALESCE(SUM(tokens), 0) AS used FROM ai_token_usage WHERE org_id = ? AND created_ms >= ?',
        [orgId, start],
      );
      used = Number(row?.used || 0);
    } catch { used = 0; }
  }
  return { used, limit: AI_TOKEN_LIMIT_5H, resetsAt, over: used >= AI_TOKEN_LIMIT_5H };
}

/** Append a usage event (best-effort — never blocks the response). */
export async function recordAiTokens(orgId: number | null | undefined, tokens: number): Promise<void> {
  if (!orgId || !tokens || tokens <= 0) return;
  try {
    await ensureAiTokenUsageTable();
    await db.query('INSERT INTO ai_token_usage (org_id, tokens, created_ms) VALUES (?, ?, ?)', {
      replacements: [orgId, Math.round(tokens), Date.now()],
    });
  } catch { /* best-effort accounting */ }
}

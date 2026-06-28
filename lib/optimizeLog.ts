import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';

/** Trim a (possibly large) content blob to a stored excerpt + its full length. */
export function compactText(s: string | null | undefined, max = 2000): { excerpt: string; length: number } {
   const str = s || '';
   return { excerpt: str.length > max ? str.slice(0, max) : str, length: str.length };
}

async function ensureTable(): Promise<void> {
   if (checked) return;
   await db.query(`
      CREATE TABLE IF NOT EXISTS optimize_logs (
         id             ${PK},
         article_id     INTEGER NOT NULL,
         kind           TEXT NOT NULL,
         before_excerpt TEXT,
         after_excerpt  TEXT,
         before_len     INTEGER,
         after_len      INTEGER,
         before_score   INTEGER,
         after_score    INTEGER,
         meta_json      TEXT,
         created_at     TIMESTAMP DEFAULT ${NOW}
      )
   `);
   try { await db.query('CREATE INDEX IF NOT EXISTS idx_optimize_logs_article ON optimize_logs(article_id)'); } catch { /* exists */ }
   checked = true;
}

export type OptimizeLogKind = 'auto-optimize' | 'publish';

/** Append a before/after record for an optimize or publish run. Best-effort — never throws. */
export async function logRun(p: {
   articleId: number;
   kind: OptimizeLogKind;
   before?: string | null;
   after?: string | null;
   beforeScore?: number | null;
   afterScore?: number | null;
   meta?: Record<string, unknown>;
}): Promise<void> {
   try {
      await ensureTable();
      const b = compactText(p.before);
      const a = compactText(p.after);
      await db.query(
         `INSERT INTO optimize_logs (article_id, kind, before_excerpt, after_excerpt, before_len, after_len, before_score, after_score, meta_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         { replacements: [p.articleId, p.kind, b.excerpt, a.excerpt, b.length, a.length, p.beforeScore ?? null, p.afterScore ?? null, p.meta ? JSON.stringify(p.meta) : null] },
      );
   } catch (e) {
      console.warn('[optimize-log] write failed:', (e as { message?: string })?.message ?? e);
   }
}

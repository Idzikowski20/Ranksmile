import db from '../database/database';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
   const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
   if (!/exist|duplicate|already/i.test(m)) console.warn(`[competitors] ${label} failed:`, m);
}

/**
 * Shared "Organic Competitors" store, keyed by (domain_id, keyword). One row per
 * competitor SERP result (top-10). Populated by lib/competitorScan from the sidecar
 * /competitor-outlines + DataForSEO domain rank. `selected` drives which competitors
 * count toward the audit charts / editor targets. Used by both the Audit tool and the
 * Content Editor via the shared modal.
 */
export async function ensureCompetitorsTables(): Promise<void> {
   if (checked) return;

   await db.query(`CREATE TABLE IF NOT EXISTS domain_serp_competitors (
      id ${PK},
      domain_id INTEGER NOT NULL,
      keyword TEXT NOT NULL,
      position INTEGER,
      url TEXT NOT NULL,
      domain TEXT,
      title TEXT,
      snippet TEXT,
      word_count INTEGER,
      heading_count INTEGER,
      seo_score INTEGER,
      authority INTEGER,
      selected INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('domain_serp_competitors', e));

   try { await db.query('CREATE INDEX IF NOT EXISTS idx_dsc_domain_kw ON domain_serp_competitors (domain_id, keyword)'); } catch (e) { ignoreExisting('idx dsc domain_kw', e); }
   // One row per (domain, keyword, url) — conflict target for the scan upsert.
   try { await db.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_dsc_uniq ON domain_serp_competitors (domain_id, keyword, url)'); } catch (e) { ignoreExisting('idx dsc uniq', e); }

   checked = true;
}

import db from '../database/database';
import { ensureSnapshotPartitionsAhead } from './rankTracking/partitions';

let checked = false;
const isPostgres = !!process.env.DATABASE_URL;
const PK = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
const JSON_T = isPostgres ? 'JSONB' : 'TEXT';
const BOOL = isPostgres ? 'BOOLEAN' : 'INTEGER';
const NOW = 'CURRENT_TIMESTAMP';

function ignoreExisting(label: string, e: unknown): void {
  const m = String((e as { message?: string } | undefined)?.message ?? e ?? '');
  if (!/exist|duplicate|already/i.test(m)) console.warn(`[rank-tracking] ${label} failed:`, m);
}

/**
 * Rank Tracking v3 tables — separate from legacy `keyword` scraper table.
 * Snapshots: regular table + indexes (PG retention via partitions.ts DELETE/partition helpers).
 */
export async function ensureRankTrackingTables(): Promise<void> {
  if (checked) return;

  await db.query(`CREATE TABLE IF NOT EXISTS rank_tracking_configs (
    id ${PK},
    domain_id INTEGER NOT NULL,
    label TEXT,
    location_code INTEGER NOT NULL DEFAULT 2840,
    language_code TEXT NOT NULL DEFAULT 'en',
    devices TEXT NOT NULL DEFAULT 'desktop',
    serp_depth INTEGER NOT NULL DEFAULT 40,
    schedule_interval TEXT NOT NULL DEFAULT 'weekly',
    schedule_every_n_days INTEGER,
    location_name TEXT,
    is_active ${BOOL} NOT NULL DEFAULT ${isPostgres ? 'true' : '1'},
    archived_at TIMESTAMP,
    last_checked_at TIMESTAMP,
    next_check_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('rank_tracking_configs', e));

  await db.query(`CREATE TABLE IF NOT EXISTS rank_tracking_keywords (
    id ${PK},
    config_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('rank_tracking_keywords', e));

  await db.query(`CREATE TABLE IF NOT EXISTS keyword_metrics (
    id ${PK},
    keyword_normalized TEXT NOT NULL,
    location_code INTEGER NOT NULL,
    language_code TEXT NOT NULL,
    volume INTEGER,
    keyword_difficulty INTEGER,
    cpc REAL,
    fetched_at TIMESTAMP NOT NULL DEFAULT ${NOW})`).catch((e) => ignoreExisting('keyword_metrics', e));

  await db.query(`CREATE TABLE IF NOT EXISTS rank_check_runs (
    id ${PK},
    config_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    trigger TEXT NOT NULL DEFAULT 'manual',
    keywords_total INTEGER NOT NULL DEFAULT 0,
    keywords_checked INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT ${NOW})`).catch((e) => ignoreExisting('rank_check_runs', e));

  await db.query(`CREATE TABLE IF NOT EXISTS rank_snapshots (
    id ${PK},
    config_id INTEGER NOT NULL,
    run_id INTEGER NOT NULL,
    tracking_keyword_id INTEGER NOT NULL,
    device TEXT NOT NULL,
    found ${BOOL} NOT NULL DEFAULT ${isPostgres ? 'false' : '0'},
    position INTEGER,
    ranking_url TEXT,
    ranking_title TEXT,
    ranking_description TEXT,
    ranking_domain TEXT,
    serp_features ${JSON_T},
    raw_items ${JSON_T},
    checked_at TIMESTAMP NOT NULL DEFAULT ${NOW})`).catch((e) => ignoreExisting('rank_snapshots', e));

  const indexes: Array<[string, string]> = [
    ['idx_rtc_domain', 'CREATE INDEX IF NOT EXISTS idx_rtc_domain ON rank_tracking_configs (domain_id)'],
    ['idx_rtc_domain_archived', 'CREATE INDEX IF NOT EXISTS idx_rtc_domain_archived ON rank_tracking_configs (domain_id, archived_at)'],
    ['idx_rtk_config', 'CREATE INDEX IF NOT EXISTS idx_rtk_config ON rank_tracking_keywords (config_id)'],
    ['idx_rtk_config_keyword', 'CREATE UNIQUE INDEX IF NOT EXISTS idx_rtk_config_keyword ON rank_tracking_keywords (config_id, keyword)'],
    ['idx_km_lookup', 'CREATE INDEX IF NOT EXISTS idx_km_lookup ON keyword_metrics (keyword_normalized, location_code, language_code, fetched_at DESC)'],
    ['idx_rcr_config_status', 'CREATE INDEX IF NOT EXISTS idx_rcr_config_status ON rank_check_runs (config_id, status, id)'],
    ['idx_rs_config_checked', 'CREATE INDEX IF NOT EXISTS idx_rs_config_checked ON rank_snapshots (config_id, checked_at DESC)'],
    ['idx_rs_kw_device_checked', 'CREATE INDEX IF NOT EXISTS idx_rs_kw_device_checked ON rank_snapshots (tracking_keyword_id, device, checked_at DESC)'],
    ['idx_rs_run', 'CREATE INDEX IF NOT EXISTS idx_rs_run ON rank_snapshots (run_id)'],
    ['idx_rs_run_kw_device', 'CREATE UNIQUE INDEX IF NOT EXISTS idx_rs_run_kw_device ON rank_snapshots (run_id, tracking_keyword_id, device)'],
  ];

  for (const [label, sql] of indexes) {
    try { await db.query(sql); } catch (e) { ignoreExisting(label, e); }
  }

  if (isPostgres) {
    try { await ensureSnapshotPartitionsAhead(); } catch (e) { ignoreExisting('partitions ahead', e); }
  }

  checked = true;
}

import db from '../../database/database';
import { queryOne, queryRows } from '../db/query';
import type {
  ComparePeriod,
  RankCheckRunRow,
  RankRunStatus,
  RankRunTrigger,
  RankSnapshotRow,
  RankTrackingConfigRow,
  RankTrackingKeywordRow,
  ScheduleInterval,
} from '../types/rankTracking';
import { devicesList, normalizeKeyword } from '../types/rankTracking';
import { MAX_KEYWORDS_PER_CONFIG, STALE_RUN_SECS } from './cost';
import { computeNextCheckAt, isScheduledInterval } from './schedule';

const isPg = !!process.env.DATABASE_URL;

export async function listConfigs(domainId: number, includeArchived = false): Promise<RankTrackingConfigRow[]> {
  const archived = includeArchived ? '' : ' AND archived_at IS NULL';
  return queryRows<RankTrackingConfigRow>(
    `SELECT * FROM rank_tracking_configs WHERE domain_id = ?${archived} ORDER BY created_at DESC`,
    [domainId],
  );
}

export async function getConfig(configId: number, domainId: number): Promise<RankTrackingConfigRow | undefined> {
  return queryOne<RankTrackingConfigRow>(
    'SELECT * FROM rank_tracking_configs WHERE id = ? AND domain_id = ? LIMIT 1',
    [configId, domainId],
  );
}

export async function createConfig(input: {
  domainId: number;
  label?: string | null;
  locationCode: number;
  languageCode: string;
  devices: RankTrackingConfigRow['devices'];
  serpDepth: number;
  scheduleInterval: ScheduleInterval;
  scheduleEveryNDays?: number | null;
  locationName?: string | null;
}): Promise<number> {
  const nextCheck = isScheduledInterval(input.scheduleInterval)
    ? computeNextCheckAt(input.scheduleInterval, input.scheduleEveryNDays ?? null)
    : null;
  if (isPg) {
    const row = await queryOne<{ id: number }>(
      `INSERT INTO rank_tracking_configs
       (domain_id, label, location_code, language_code, devices, serp_depth, schedule_interval, schedule_every_n_days, location_name, next_check_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        input.domainId, input.label ?? null, input.locationCode, input.languageCode,
        input.devices, input.serpDepth, input.scheduleInterval, input.scheduleEveryNDays ?? null,
        input.locationName ?? null, nextCheck,
      ],
    );
    if (!row) throw new Error('Failed to create config');
    return row.id;
  }
  await db.query(
    `INSERT INTO rank_tracking_configs
     (domain_id, label, location_code, language_code, devices, serp_depth, schedule_interval, schedule_every_n_days, location_name, next_check_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        input.domainId, input.label ?? null, input.locationCode, input.languageCode,
        input.devices, input.serpDepth, input.scheduleInterval, input.scheduleEveryNDays ?? null,
        input.locationName ?? null, nextCheck,
      ],
    },
  );
  const row = await queryOne<{ id: number }>(
    'SELECT id FROM rank_tracking_configs WHERE domain_id = ? ORDER BY id DESC LIMIT 1',
    [input.domainId],
  );
  if (!row) throw new Error('Failed to create config');
  return row.id;
}

export async function updateConfig(
  configId: number,
  domainId: number,
  patch: Partial<Pick<RankTrackingConfigRow, 'label' | 'devices' | 'serp_depth' | 'schedule_interval' | 'schedule_every_n_days' | 'is_active' | 'location_name'>>,
): Promise<void> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (patch.label !== undefined) { fields.push('label = ?'); vals.push(patch.label); }
  if (patch.devices !== undefined) { fields.push('devices = ?'); vals.push(patch.devices); }
  if (patch.serp_depth !== undefined) { fields.push('serp_depth = ?'); vals.push(patch.serp_depth); }
  if (patch.schedule_interval !== undefined) { fields.push('schedule_interval = ?'); vals.push(patch.schedule_interval); }
  if (patch.schedule_every_n_days !== undefined) { fields.push('schedule_every_n_days = ?'); vals.push(patch.schedule_every_n_days); }
  if (patch.is_active !== undefined) { fields.push(`is_active = ?`); vals.push(patch.is_active); }
  if (patch.location_name !== undefined) { fields.push('location_name = ?'); vals.push(patch.location_name); }
  if (!fields.length) return;
  vals.push(configId, domainId);
  await db.query(
    `UPDATE rank_tracking_configs SET ${fields.join(', ')} WHERE id = ? AND domain_id = ?`,
    { replacements: vals },
  );
}

export async function archiveConfig(configId: number, domainId: number): Promise<void> {
  await db.query(
    'UPDATE rank_tracking_configs SET archived_at = CURRENT_TIMESTAMP, is_active = ? WHERE id = ? AND domain_id = ?',
    { replacements: [isPg ? false : 0, configId, domainId] },
  );
}

export async function listKeywords(configId: number): Promise<RankTrackingKeywordRow[]> {
  return queryRows<RankTrackingKeywordRow>(
    'SELECT * FROM rank_tracking_keywords WHERE config_id = ? ORDER BY keyword ASC',
    [configId],
  );
}

export async function addKeywords(configId: number, keywords: string[]): Promise<number[]> {
  const existing = await listKeywords(configId);
  const set = new Set(existing.map((k) => normalizeKeyword(k.keyword)));
  const ids: number[] = [];
  for (const raw of keywords) {
    const kw = raw.trim();
    if (!kw) continue;
    const norm = normalizeKeyword(kw);
    if (set.has(norm)) continue;
    if (existing.length + ids.length >= MAX_KEYWORDS_PER_CONFIG) break;
    set.add(norm);
    if (isPg) {
      const row = await queryOne<{ id: number }>(
        'INSERT INTO rank_tracking_keywords (config_id, keyword) VALUES (?, ?) RETURNING id',
        [configId, kw],
      );
      if (row) ids.push(row.id);
    } else {
      await db.query(
        'INSERT INTO rank_tracking_keywords (config_id, keyword) VALUES (?, ?)',
        { replacements: [configId, kw] },
      );
      const row = await queryOne<{ id: number }>(
        'SELECT id FROM rank_tracking_keywords WHERE config_id = ? AND keyword = ? LIMIT 1',
        [configId, kw],
      );
      if (row) ids.push(row.id);
    }
  }
  return ids;
}

export async function removeKeywords(configId: number, keywordIds: number[]): Promise<void> {
  if (!keywordIds.length) return;
  const placeholders = keywordIds.map(() => '?').join(',');
  await db.query(
    `DELETE FROM rank_tracking_keywords WHERE config_id = ? AND id IN (${placeholders})`,
    { replacements: [configId, ...keywordIds] },
  );
}

export async function createRun(configId: number, trigger: RankRunTrigger, keywordsTotal: number): Promise<number> {
  if (isPg) {
    const row = await queryOne<{ id: number }>(
      `INSERT INTO rank_check_runs (config_id, status, trigger, keywords_total, keywords_checked, attempts)
       VALUES (?, 'pending', ?, ?, 0, 0) RETURNING id`,
      [configId, trigger, keywordsTotal],
    );
    if (!row) throw new Error('Failed to create run');
    return row.id;
  }
  await db.query(
    `INSERT INTO rank_check_runs (config_id, status, trigger, keywords_total, keywords_checked, attempts)
     VALUES (?, 'pending', ?, ?, 0, 0)`,
    { replacements: [configId, trigger, keywordsTotal] },
  );
  const row = await queryOne<{ id: number }>(
    'SELECT id FROM rank_check_runs WHERE config_id = ? ORDER BY id DESC LIMIT 1',
    [configId],
  );
  if (!row) throw new Error('Failed to create run');
  return row.id;
}

export async function claimRun(configId: number): Promise<RankCheckRunRow | undefined> {
  if (isPg) {
    return queryOne<RankCheckRunRow>(
      `UPDATE rank_check_runs SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), attempts = attempts + 1
       WHERE id = (
         SELECT id FROM rank_check_runs
         WHERE config_id = ? AND status IN ('pending', 'partial', 'running')
         ORDER BY id ASC LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [configId],
    );
  }
  const pending = await queryOne<RankCheckRunRow>(
    `SELECT * FROM rank_check_runs WHERE config_id = ? AND status IN ('pending', 'partial', 'running') ORDER BY id ASC LIMIT 1`,
    [configId],
  );
  if (!pending) return undefined;
  await db.query(
    `UPDATE rank_check_runs SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), attempts = attempts + 1 WHERE id = ?`,
    { replacements: [pending.id] },
  );
  return { ...pending, status: 'running', attempts: pending.attempts + 1 };
}

export async function getActiveRun(configId: number): Promise<RankCheckRunRow | undefined> {
  return queryOne<RankCheckRunRow>(
    `SELECT * FROM rank_check_runs WHERE config_id = ? AND status IN ('pending', 'running', 'partial') ORDER BY id DESC LIMIT 1`,
    [configId],
  );
}

export async function updateRun(
  runId: number,
  patch: Partial<Pick<RankCheckRunRow, 'status' | 'keywords_checked' | 'last_error' | 'finished_at'>>,
): Promise<void> {
  const fields: string[] = [];
  const vals: unknown[] = [];
  if (patch.status !== undefined) { fields.push('status = ?'); vals.push(patch.status); }
  if (patch.keywords_checked !== undefined) { fields.push('keywords_checked = ?'); vals.push(patch.keywords_checked); }
  if (patch.last_error !== undefined) { fields.push('last_error = ?'); vals.push(patch.last_error); }
  if (patch.finished_at !== undefined) { fields.push('finished_at = ?'); vals.push(patch.finished_at); }
  if (!fields.length) return;
  vals.push(runId);
  await db.query(`UPDATE rank_check_runs SET ${fields.join(', ')} WHERE id = ?`, { replacements: vals });
}

export async function reclaimStaleRuns(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUN_SECS * 1000).toISOString();
  const [, meta] = await db.query(
    `UPDATE rank_check_runs SET status = 'partial' WHERE status = 'running' AND started_at < ?`,
    { replacements: [cutoff] },
  );
  return typeof meta === 'number' ? meta : (meta as { rowCount?: number })?.rowCount ?? 0;
}

export async function upsertSnapshot(input: {
  configId: number;
  runId: number;
  trackingKeywordId: number;
  device: RankSnapshotRow['device'];
  found: boolean;
  position: number | null;
  rankingUrl: string | null;
  rankingTitle: string | null;
  rankingDescription: string | null;
  rankingDomain: string | null;
  serpFeatures: string[];
  rawItems: unknown[];
}): Promise<void> {
  const serpJson = JSON.stringify(input.serpFeatures);
  const rawJson = JSON.stringify(input.rawItems);
  const isPgDb = !!process.env.DATABASE_URL;

  if (isPgDb) {
    await db.query(
      `INSERT INTO rank_snapshots
       (config_id, run_id, tracking_keyword_id, device, found, position, ranking_url, ranking_title, ranking_description, ranking_domain, serp_features, raw_items, checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (run_id, tracking_keyword_id, device) DO UPDATE SET
         found = EXCLUDED.found,
         position = EXCLUDED.position,
         ranking_url = EXCLUDED.ranking_url,
         ranking_title = EXCLUDED.ranking_title,
         ranking_description = EXCLUDED.ranking_description,
         ranking_domain = EXCLUDED.ranking_domain,
         serp_features = EXCLUDED.serp_features,
         raw_items = EXCLUDED.raw_items,
         checked_at = CURRENT_TIMESTAMP`,
      {
        replacements: [
          input.configId, input.runId, input.trackingKeywordId, input.device,
          input.found, input.position, input.rankingUrl, input.rankingTitle,
          input.rankingDescription, input.rankingDomain, serpJson, rawJson,
        ],
      },
    );
    return;
  }

  const existing = await queryOne<{ id: number }>(
    'SELECT id FROM rank_snapshots WHERE run_id = ? AND tracking_keyword_id = ? AND device = ? LIMIT 1',
    [input.runId, input.trackingKeywordId, input.device],
  );
  if (existing) {
    await db.query(
      `UPDATE rank_snapshots SET found = ?, position = ?, ranking_url = ?, ranking_title = ?, ranking_description = ?,
       ranking_domain = ?, serp_features = ?, raw_items = ?, checked_at = CURRENT_TIMESTAMP WHERE id = ?`,
      {
        replacements: [
          input.found ? 1 : 0, input.position, input.rankingUrl, input.rankingTitle,
          input.rankingDescription, input.rankingDomain, serpJson, rawJson, existing.id,
        ],
      },
    );
  } else {
    await db.query(
      `INSERT INTO rank_snapshots
       (config_id, run_id, tracking_keyword_id, device, found, position, ranking_url, ranking_title, ranking_description, ranking_domain, serp_features, raw_items)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      {
        replacements: [
          input.configId, input.runId, input.trackingKeywordId, input.device,
          input.found ? 1 : 0, input.position, input.rankingUrl, input.rankingTitle,
          input.rankingDescription, input.rankingDomain, serpJson, rawJson,
        ],
      },
    );
  }
}

export async function countSnapshotsForRun(runId: number): Promise<number> {
  const row = await queryOne<{ c: number }>(
    'SELECT COUNT(DISTINCT tracking_keyword_id || device) AS c FROM rank_snapshots WHERE run_id = ?',
    [runId],
  );
  return Number(row?.c ?? 0);
}

export async function listPendingSnapshotWork(
  runId: number,
  keywords: RankTrackingKeywordRow[],
  devices: ReturnType<typeof devicesList>,
  limit: number,
): Promise<Array<{ kw: RankTrackingKeywordRow; device: RankSnapshotRow['device'] }>> {
  const existing = await queryRows<{ tracking_keyword_id: number; device: string }>(
    'SELECT tracking_keyword_id, device FROM rank_snapshots WHERE run_id = ?',
    [runId],
  );
  const done = new Set(existing.map((e) => `${e.tracking_keyword_id}:${e.device}`));
  const pending: Array<{ kw: RankTrackingKeywordRow; device: RankSnapshotRow['device'] }> = [];
  for (const kw of keywords) {
    for (const device of devices) {
      if (done.has(`${kw.id}:${device}`)) continue;
      pending.push({ kw, device });
      if (pending.length >= limit) return pending;
    }
  }
  return pending;
}

export async function getDueConfigs(): Promise<RankTrackingConfigRow[]> {
  return queryRows<RankTrackingConfigRow>(
    `SELECT * FROM rank_tracking_configs
     WHERE is_active = ${isPg ? 'true' : '1'} AND archived_at IS NULL
       AND schedule_interval != 'manual' AND next_check_at IS NOT NULL AND next_check_at <= CURRENT_TIMESTAMP`,
  );
}

export async function advanceNextCheck(config: RankTrackingConfigRow): Promise<void> {
  if (!isScheduledInterval(config.schedule_interval)) return;
  const next = computeNextCheckAt(
    config.schedule_interval,
    config.schedule_every_n_days,
    config.next_check_at,
  );
  await db.query(
    'UPDATE rank_tracking_configs SET next_check_at = ?, last_checked_at = CURRENT_TIMESTAMP WHERE id = ?',
    { replacements: [next, config.id] },
  );
}

export function devicesForConfig(config: RankTrackingConfigRow): ReturnType<typeof devicesList> {
  return devicesList(config.devices);
}

export async function getDomainHost(domainId: number): Promise<string> {
  const row = await queryOne<{ domain: string }>(
    'SELECT domain FROM domain WHERE "ID" = ? LIMIT 1',
    [domainId],
  );
  return row?.domain?.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '') ?? '';
}

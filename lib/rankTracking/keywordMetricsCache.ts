import db from '../../database/database';
import { queryOne } from '../db/query';
import type { KeywordMetricsRow } from '../types/rankTracking';
import { normalizeKeyword } from '../types/rankTracking';
import { getKeywordOverview } from '../dataforseo';
import { METRICS_CACHE_TTL_DAYS } from './cost';

export type MetricsLookupKey = {
  keyword: string;
  locationCode: number;
  languageCode: string;
};

function ttlCutoff(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - METRICS_CACHE_TTL_DAYS);
  return d.toISOString();
}

export async function getLatestMetrics(
  keys: MetricsLookupKey[],
): Promise<Map<string, KeywordMetricsRow>> {
  const out = new Map<string, KeywordMetricsRow>();
  const cutoff = ttlCutoff();

  for (const key of keys) {
    const norm = normalizeKeyword(key.keyword);
    const row = await queryOne<KeywordMetricsRow>(
      `SELECT id, keyword_normalized, location_code, language_code, volume, keyword_difficulty, cpc, fetched_at
       FROM keyword_metrics
       WHERE keyword_normalized = ? AND location_code = ? AND language_code = ? AND fetched_at >= ?
       ORDER BY fetched_at DESC LIMIT 1`,
      [norm, key.locationCode, key.languageCode, cutoff],
    );
    if (row) {
      out.set(`${norm}:${key.locationCode}:${key.languageCode}`, row);
    }
  }
  return out;
}

export async function refreshMetricsForKeys(
  keys: MetricsLookupKey[],
): Promise<Map<string, KeywordMetricsRow>> {
  const out = new Map<string, KeywordMetricsRow>();
  const cached = await getLatestMetrics(keys);
  const missing: MetricsLookupKey[] = keys.filter((k) => {
    const norm = normalizeKeyword(k.keyword);
    return !cached.has(`${norm}:${k.locationCode}:${k.languageCode}`);
  });

  for (const [k, v] of cached) out.set(k, v);

  if (!missing.length) return out;

  const byLocale = new Map<string, MetricsLookupKey[]>();
  for (const k of missing) {
    const localeKey = `${k.locationCode}:${k.languageCode}`;
    const arr = byLocale.get(localeKey) ?? [];
    arr.push(k);
    byLocale.set(localeKey, arr);
  }

  for (const [, group] of byLocale) {
    const sample = group[0];
    const keywords = group.map((g) => g.keyword);
    let fetched: Awaited<ReturnType<typeof getKeywordOverview>> = [];
    try {
      fetched = await getKeywordOverview({
        keywords,
        locationCode: sample.locationCode,
        languageCode: sample.languageCode,
      });
    } catch {
      // DFS unavailable (402 balance, timeout, etc.) — keep cached metrics only.
      continue;
    }

    for (const m of fetched) {
      const norm = normalizeKeyword(m.keyword);
      await db.query(
        `INSERT INTO keyword_metrics (keyword_normalized, location_code, language_code, volume, keyword_difficulty, cpc, fetched_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        { replacements: [norm, sample.locationCode, sample.languageCode, m.search_volume, m.keyword_difficulty, m.cpc] },
      );
      const row = await queryOne<KeywordMetricsRow>(
        `SELECT id, keyword_normalized, location_code, language_code, volume, keyword_difficulty, cpc, fetched_at
         FROM keyword_metrics
         WHERE keyword_normalized = ? AND location_code = ? AND language_code = ?
         ORDER BY fetched_at DESC LIMIT 1`,
        [norm, sample.locationCode, sample.languageCode],
      );
      if (row) out.set(`${norm}:${sample.locationCode}:${sample.languageCode}`, row);
    }
  }

  return out;
}

export function metricsForKeyword(
  map: Map<string, KeywordMetricsRow>,
  keyword: string,
  locationCode: number,
  languageCode: string,
): { volume: number | null; kd: number | null; cpc: number | null } {
  const norm = normalizeKeyword(keyword);
  const row = map.get(`${norm}:${locationCode}:${languageCode}`);
  return {
    volume: row?.volume ?? null,
    kd: row?.keyword_difficulty ?? null,
    cpc: row?.cpc ?? null,
  };
}

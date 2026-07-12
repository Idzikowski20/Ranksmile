import type { RankDevices } from '../types/rankTracking';
import { devicesCount } from '../types/rankTracking';

const LIVE_BASE_PAGE_COST_USD = 0.002;
const LIVE_EXTRA_PAGE_COST_USD = 0.0015;
const QUEUED_BASE_PAGE_COST_USD = 0.0006;
const QUEUED_EXTRA_PAGE_COST_USD = 0.00045;
const COST_MARKUP = 1.0;

export type RankCheckMethod = 'live' | 'queued';

export const KEYWORDS_PER_BATCH = 10;
export const SECONDS_PER_BATCH = 6;
export const MAX_KEYWORDS_PER_CONFIG = 1000;
export const MAX_TRACKED_KEYWORD_LENGTH = 200;
export const MAX_CONFIGS_PER_DOMAIN = 50;
export const MAX_RUN_ATTEMPTS = 3;
export const STALE_RUN_SECS = 5 * 60;
export const METRICS_CACHE_TTL_DAYS = 7;

function costPerSerpAtDepth(depth: number, method: RankCheckMethod): number {
  const pages = Math.max(1, depth / 10);
  return method === 'queued'
    ? QUEUED_BASE_PAGE_COST_USD + (pages - 1) * QUEUED_EXTRA_PAGE_COST_USD
    : LIVE_BASE_PAGE_COST_USD + (pages - 1) * LIVE_EXTRA_PAGE_COST_USD;
}

export function estimateRankCheckCostUsd(
  keywordCount: number,
  devices: RankDevices,
  depth: number,
  method: RankCheckMethod = 'live',
): number {
  const totalChecks = keywordCount * devicesCount(devices);
  const raw = totalChecks * costPerSerpAtDepth(depth, method) * COST_MARKUP;
  return Math.round(raw * 100) / 100;
}

export function estimateBatchSeconds(keywordCount: number): number {
  const batches = Math.ceil(keywordCount / KEYWORDS_PER_BATCH);
  return batches * SECONDS_PER_BATCH;
}

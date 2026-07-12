/** Rank Tracking v3 — shared types (API + UI + lib). */

export type RankDevices = 'desktop' | 'mobile' | 'both';
export type RankDevice = 'desktop' | 'mobile';
export type ScheduleInterval = 'daily' | 'weekly' | 'monthly' | 'every_n_days' | 'manual';
export type RankRunStatus = 'pending' | 'running' | 'partial' | 'completed' | 'failed';
export type RankRunTrigger = 'manual' | 'scheduled';
export type ComparePeriod = '1d' | '7d' | '30d' | '90d';
export type ExportFormat = 'csv' | 'json';

export interface RankTrackingConfigRow {
  id: number;
  domain_id: number;
  label: string | null;
  location_code: number;
  language_code: string;
  devices: RankDevices;
  serp_depth: number;
  schedule_interval: ScheduleInterval;
  schedule_every_n_days: number | null;
  location_name: string | null;
  is_active: boolean;
  archived_at: string | null;
  last_checked_at: string | null;
  next_check_at: string | null;
  created_at: string | null;
}

export interface RankTrackingKeywordRow {
  id: number;
  config_id: number;
  keyword: string;
  created_at: string | null;
}

export interface KeywordMetricsRow {
  id: number;
  keyword_normalized: string;
  location_code: number;
  language_code: string;
  volume: number | null;
  keyword_difficulty: number | null;
  cpc: number | null;
  fetched_at: string;
}

export interface RankCheckRunRow {
  id: number;
  config_id: number;
  status: RankRunStatus;
  trigger: RankRunTrigger;
  keywords_total: number;
  keywords_checked: number;
  attempts: number;
  last_error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
}

export interface RankSnapshotRow {
  id: number;
  config_id: number;
  run_id: number;
  tracking_keyword_id: number;
  device: RankDevice;
  found: boolean;
  position: number | null;
  ranking_url: string | null;
  ranking_title: string | null;
  ranking_description: string | null;
  ranking_domain: string | null;
  serp_features: string[] | null;
  raw_items: unknown[] | null;
  checked_at: string;
}

export interface RankTrackingDeviceResult {
  position: number | null;
  previousPosition: number | null;
  rankingUrl: string | null;
  rankingTitle: string | null;
  found: boolean;
  serpFeatures: string[];
  /** True once at least one rank snapshot exists for this keyword/device. */
  hasSnapshot: boolean;
}

export interface RankTrackingRow {
  trackingKeywordId: number;
  keyword: string;
  searchVolume: number | null;
  keywordDifficulty: number | null;
  cpc: number | null;
  desktop: RankTrackingDeviceResult;
  mobile: RankTrackingDeviceResult;
}

export interface RankResultsPage {
  rows: RankTrackingRow[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
  page?: number;
  pageSize?: number;
}

export interface RankAnalyticsSummary {
  topGainers: Array<{ keyword: string; trackingKeywordId: number; delta: number; position: number | null }>;
  topLosers: Array<{ keyword: string; trackingKeywordId: number; delta: number; position: number | null }>;
  newlyRanked: Array<{ keyword: string; trackingKeywordId: number; position: number | null }>;
  lostRankings: Array<{ keyword: string; trackingKeywordId: number; previousPosition: number | null }>;
  averagePosition: number | null;
  visibilityScore: { top3: number; top10: number; top20: number; notRanking: number };
}

export interface RankHistorySummaryPoint {
  date: string;
  position: number | null;
  found: boolean;
}

export interface RankHistorySummaryItem {
  trackingKeywordId: number;
  keyword: string;
  min: number | null;
  max: number | null;
  avg: number | null;
  delta: number | null;
  points: RankHistorySummaryPoint[];
}

export function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function devicesList(devices: RankDevices): RankDevice[] {
  if (devices === 'both') return ['desktop', 'mobile'];
  return [devices];
}

export function devicesCount(devices: RankDevices): number {
  return devices === 'both' ? 2 : 1;
}

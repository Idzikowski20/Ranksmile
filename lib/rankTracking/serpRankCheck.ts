import axios from 'axios';
import { getKeywordOverview, isDataForSeoConfigured } from '../dataforseo';
import { serpCrawlBudget } from '../dataforseoBudget';
import type { RankDevice } from '../types/rankTracking';
import { withDfsRateLimit } from './dfsRateLimiter';

const BASE = 'https://api.dataforseo.com/v3';

type SerpItem = {
  type?: string;
  rank_group?: number | null;
  rank_absolute?: number | null;
  domain?: string | null;
  title?: string | null;
  url?: string | null;
  description?: string | null;
};

type DfsApiResponse = {
  status_code?: number;
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result?: Array<{ items?: SerpItem[] }>;
  }>;
};

export interface RankCheckBuildInput {
  keywordId: string;
  keyword: string;
  targetDomain: string;
}

export interface RankCheckBuiltResult {
  keywordId: string;
  keyword: string;
  found: boolean;
  position: number | null;
  url: string | null;
  title: string | null;
  description: string | null;
  domain: string | null;
  serpFeatures: string[];
  rawItems: SerpItem[];
}

function authHeader(): string {
  const login = process.env.DATAFORSEO_LOGIN || '';
  const password = process.env.DATAFORSEO_PASSWORD || '';
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
}

function clampDepth(depth: number): number {
  return Math.min(100, Math.max(10, depth));
}

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
}

export function buildRankCheckResult(input: RankCheckBuildInput, items: SerpItem[]): RankCheckBuiltResult {
  const target = normalizeDomain(input.targetDomain);
  const organicMatch = items.find((item) => {
    if (item.type !== 'organic' || !item.domain) return false;
    const d = item.domain.toLowerCase().replace(/^www\./, '');
    return d === target || d.endsWith(`.${target}`);
  });

  const position = organicMatch
    ? (organicMatch.rank_absolute ?? organicMatch.rank_group ?? null)
    : null;

  return {
    keywordId: input.keywordId,
    keyword: input.keyword,
    found: position !== null,
    position,
    url: organicMatch?.url ?? null,
    title: organicMatch?.title ?? null,
    description: organicMatch?.description ?? null,
    domain: organicMatch?.domain ?? null,
    serpFeatures: [...new Set(items.map((i) => i.type).filter((t): t is string => !!t))],
    rawItems: items,
  };
}

export function extractRawItems(taskResult: Array<{ items?: SerpItem[] }> | undefined): SerpItem[] {
  return taskResult?.[0]?.items ?? [];
}

async function dfsPost(path: string, task: Record<string, unknown>): Promise<SerpItem[]> {
  if (!isDataForSeoConfigured()) {
    throw new Error('DataForSEO not configured');
  }
  return withDfsRateLimit(async () => {
    const res = await axios.post<DfsApiResponse>(`${BASE}${path}`, [task], {
      headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
      timeout: 90000,
    });
    if (res.data?.status_code !== 20000) {
      throw new Error(`DataForSEO API ${res.data?.status_code}`);
    }
    const taskData = res.data?.tasks?.[0];
    if (!taskData) return [];
    if (taskData.status_code === 40501) return [];
    if (taskData.status_code !== 20000) {
      throw new Error(`DataForSEO task ${taskData.status_code}: ${taskData.status_message}`);
    }
    return extractRawItems(taskData.result);
  });
}

export async function fetchRankCheckSerpLive(input: {
  keyword: string;
  keywordId: string;
  locationCode: number;
  languageCode: string;
  locationName?: string | null;
  device: RankDevice;
  targetDomain: string;
  depth: number;
}): Promise<RankCheckBuiltResult> {
  const depth = clampDepth(input.depth);
  const locationParams = input.locationName
    ? { location_name: input.locationName }
    : { location_code: input.locationCode };
  const budget = serpCrawlBudget({ ownDomain: input.targetDomain, withSubdomains: true });
  const items = await dfsPost('/serp/google/organic/live/advanced', {
    keyword: input.keyword,
    ...locationParams,
    language_code: input.languageCode,
    device: input.device,
    os: input.device === 'desktop' ? 'windows' : 'android',
    depth,
    ...budget,
  });
  return buildRankCheckResult(
    { keywordId: input.keywordId, keyword: input.keyword, targetDomain: input.targetDomain },
    items,
  );
}

export async function fetchKeywordOverviewMetrics(input: {
  keywords: string[];
  locationCode: number;
  languageCode: string;
}): Promise<Array<{ keyword: string; volume: number | null; kd: number | null; cpc: number | null }>> {
  const rows = await getKeywordOverview({
    keywords: input.keywords,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  });
  return rows.map((r) => ({
    keyword: r.keyword,
    volume: r.search_volume,
    kd: r.keyword_difficulty,
    cpc: r.cpc,
  }));
}

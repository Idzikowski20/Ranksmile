/**
 * Shared DataForSEO HTTP client for providers/dataforseo/*.
 * Legacy callers still use lib/dataforseo.ts — do not import domain types here.
 */
import axios from 'axios';

const BASE = 'https://api.dataforseo.com/v3';

export const isDataForSeoConfigured = (): boolean => (
  !!(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD)
);

const authHeader = (): string => {
  const login = process.env.DATAFORSEO_LOGIN || '';
  const password = process.env.DATAFORSEO_PASSWORD || '';
  return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
};

const LOCATION_CODES: Record<string, number> = {
  PL: 2616, US: 2840, GB: 2826, DE: 2276, FR: 2250,
  ES: 2724, IT: 2380, NL: 2528, PT: 2620,
};

export const locationCodeFor = (country?: string): number => (
  LOCATION_CODES[(country || 'US').toUpperCase()] ?? 2840
);

type DfsApiResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: Array<{
    status_code?: number;
    status_message?: string;
    result?: unknown[];
  }>;
};

/** POST a live task; returns the first task result object (not only items). */
export async function dfsPostResult<T extends Record<string, unknown>>(
  path: string,
  task: Record<string, unknown>,
): Promise<T> {
  if (!isDataForSeoConfigured()) {
    throw new Error('DataForSEO not configured — set DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.');
  }
  const res = await axios.post<DfsApiResponse>(`${BASE}${path}`, [task], {
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    timeout: 90000,
  });

  if (res.data?.status_code !== 20000) {
    throw new Error(`DataForSEO API ${res.data?.status_code}: ${res.data?.status_message}`);
  }
  const taskData = res.data?.tasks?.[0];
  if (taskData?.status_code !== 20000) {
    throw new Error(`DataForSEO task ${taskData?.status_code}: ${taskData?.status_message}`);
  }
  const result = taskData?.result?.[0];
  if (!result || typeof result !== 'object') {
    return {} as T;
  }
  return result as T;
}

export function normalizeTargetDomain(target: string): string {
  return target.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase();
}

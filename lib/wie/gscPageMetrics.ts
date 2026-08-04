/**
 * Pure GSC page aggregation for WIE Outcome Learning (no DB).
 */
import { normalizeUrlForMatch } from '../../utils/gsc';

export type PageGscMetrics = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  rowsMatched: number;
  matchedUrl: string;
};

export type ScPageRow = {
  page?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

/** Aggregate GSC rows for a page URL (exact pathname match). */
export function aggregateGscPageMetrics(
  rows: ScPageRow[],
  pageUrl: string,
): PageGscMetrics | null {
  const target = normalizeUrlForMatch(pageUrl);
  let clicks = 0;
  let impressions = 0;
  let wpos = 0;
  let matched = 0;
  let matchedUrl = pageUrl;

  for (const row of rows) {
    if (!row.page) continue;
    if (normalizeUrlForMatch(row.page) !== target) continue;
    const c = row.clicks || 0;
    const impr = row.impressions || 0;
    clicks += c;
    impressions += impr;
    wpos += (row.position || 0) * impr;
    matched += 1;
    matchedUrl = row.page;
  }

  if (matched === 0) return null;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const position = impressions > 0 ? wpos / impressions : 0;
  return { clicks, impressions, ctr, position, rowsMatched: matched, matchedUrl };
}

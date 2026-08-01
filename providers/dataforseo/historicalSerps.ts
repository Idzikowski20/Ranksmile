/**
 * DataForSEO Labs historical_serps — monthly SERP snapshots for one keyword.
 * We extract the target domain's organic rank_group over time.
 */
import { toDfsLanguageCode } from '../../lib/domainLanguagePrompts';
import {
  dfsPostResultList,
  isDataForSeoConfigured,
  locationCodeFor,
  normalizeTargetDomain,
} from './client';

export type KeywordPositionPoint = {
  date: string;
  position: number | null;
};

type SerpItem = {
  type?: string;
  domain?: string;
  main_domain?: string;
  rank_group?: number;
  rank_absolute?: number;
};

type HistoricalSerpRow = {
  datetime?: string;
  date?: string;
  items?: SerpItem[];
};

function hostMatches(a: string, b: string): boolean {
  const na = normalizeTargetDomain(a);
  const nb = normalizeTargetDomain(b);
  return na === nb || na.endsWith(`.${nb}`) || nb.endsWith(`.${na}`);
}

function positionForDomain(items: SerpItem[] | undefined, target: string): number | null {
  if (!items?.length) return null;
  let best: number | null = null;
  for (const item of items) {
    if (item.type && item.type !== 'organic') continue;
    const host = item.main_domain || item.domain || '';
    if (!host || !hostMatches(host, target)) continue;
    const pos = item.rank_group ?? item.rank_absolute;
    if (typeof pos !== 'number' || pos <= 0) continue;
    if (best == null || pos < best) best = pos;
  }
  return best;
}

function rowDate(row: HistoricalSerpRow): string | null {
  const raw = row.datetime || row.date;
  if (!raw) return null;
  const d = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

/** Monthly position history for `target` domain on `keyword` (up to ~12 months). */
export async function fetchKeywordPositionHistory(opts: {
  keyword: string;
  target: string;
  country?: string;
  languageCode?: string;
  dateFrom?: string;
}): Promise<KeywordPositionPoint[]> {
  if (!isDataForSeoConfigured()) return [];
  const keyword = opts.keyword.trim();
  if (!keyword) return [];

  const dateFrom = opts.dateFrom || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const rows = await dfsPostResultList<HistoricalSerpRow>(
    '/dataforseo_labs/google/historical_serps/live',
    {
      keyword,
      location_code: locationCodeFor(opts.country),
      language_code: toDfsLanguageCode(opts.languageCode, 'en'),
      date_from: dateFrom,
    },
  );

  const target = normalizeTargetDomain(opts.target);
  const points: KeywordPositionPoint[] = [];
  for (const row of rows) {
    const date = rowDate(row);
    if (!date) continue;
    points.push({
      date,
      position: positionForDomain(row.items, target),
    });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

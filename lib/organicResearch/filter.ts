import type { KeywordState, OrganicKeyword, SearchIntent } from './types';

export type OrganicTab = 'all' | 'organic' | 'serp_features';

export type OrganicFilters = {
  tab?: OrganicTab;
  q?: string;
  /** Inclusive position range (1–100). Null = no bound. */
  positionMin?: number | null;
  positionMax?: number | null;
  volumeMin?: number | null;
  volumeMax?: number | null;
  kdMin?: number | null;
  kdMax?: number | null;
  /** Multi-select intents; empty / undefined = all. */
  intents?: SearchIntent[];
  /** Multi-select SERP feature types; empty = all. */
  serpFeatures?: string[];
  state?: KeywordState | 'all';
};

export type OrganicSortKey =
  | 'keyword'
  | 'position'
  | 'traffic'
  | 'trafficShare'
  | 'volume'
  | 'difficulty'
  | 'opportunityScore'
  | 'updatedAt';

function inPositionRange(pos: number | null, min?: number | null, max?: number | null): boolean {
  if (min == null && max == null) return true;
  if (pos == null) return false;
  if (min != null && pos < min) return false;
  if (max != null && pos > max) return false;
  return true;
}

export function filterKeywords(keywords: OrganicKeyword[], filters: OrganicFilters): OrganicKeyword[] {
  const q = (filters.q || '').trim().toLowerCase();
  const intents = (filters.intents || []).filter(Boolean) as NonNullable<SearchIntent>[];
  const features = filters.serpFeatures || [];

  return keywords.filter((k) => {
    if (filters.tab === 'organic' && k.itemType !== 'organic') return false;
    if (filters.tab === 'serp_features' && k.itemType === 'organic') return false;
    if (q && !k.keyword.toLowerCase().includes(q)) return false;
    if (!inPositionRange(k.position, filters.positionMin, filters.positionMax)) return false;
    if (filters.volumeMin != null && (k.volume == null || k.volume < filters.volumeMin)) return false;
    if (filters.volumeMax != null && (k.volume == null || k.volume > filters.volumeMax)) return false;
    if (filters.kdMin != null && (k.difficulty == null || k.difficulty < filters.kdMin)) return false;
    if (filters.kdMax != null && (k.difficulty == null || k.difficulty > filters.kdMax)) return false;
    if (intents.length && (!k.intent || !intents.includes(k.intent))) return false;
    if (features.length && !features.some((f) => k.serpFeatures.includes(f))) return false;
    if (filters.state && filters.state !== 'all' && k.state !== filters.state) return false;
    return true;
  });
}

export function sortKeywords(
  keywords: OrganicKeyword[],
  sort: OrganicSortKey = 'traffic',
  order: 'asc' | 'desc' = 'desc',
): OrganicKeyword[] {
  const dir = order === 'asc' ? 1 : -1;
  const sorted = [...keywords];
  sorted.sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * dir;
    }
    const an = av == null ? (order === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : Number(av);
    const bn = bv == null ? (order === 'asc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY) : Number(bv);
    return (an - bn) * dir;
  });
  return sorted;
}

export function paginateKeywords<T>(rows: T[], page: number, pageSize: number): {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
} {
  const p = Math.max(1, page);
  const size = Math.min(100, Math.max(1, pageSize));
  const start = (p - 1) * size;
  return {
    rows: rows.slice(start, start + size),
    total: rows.length,
    page: p,
    pageSize: size,
  };
}

/** Encode position preset for CompactSelect value. */
export function positionFilterValue(filters: OrganicFilters): string {
  const min = filters.positionMin ?? null;
  const max = filters.positionMax ?? null;
  if (min == null && max == null) return 'all';
  if (min === 1 && max === 50) return 'top50';
  if (min === 1 && max === 20) return 'top20';
  if (min === 1 && max === 10) return 'top10';
  if (min === 1 && max === 3) return 'top3';
  if (min === 1 && max === 1) return 'pos1';
  if (min === 4 && max === 10) return '4_10';
  if (min === 11 && max === 20) return '11_20';
  if (min === 21 && max === 50) return '21_50';
  if (min === 51 && max === 100) return '51_100';
  return `custom:${min ?? ''}:${max ?? ''}`;
}

export function positionFilterFromValue(value: string): Pick<OrganicFilters, 'positionMin' | 'positionMax'> {
  switch (value) {
    case 'all': return { positionMin: null, positionMax: null };
    case 'top50': return { positionMin: 1, positionMax: 50 };
    case 'top20': return { positionMin: 1, positionMax: 20 };
    case 'top10': return { positionMin: 1, positionMax: 10 };
    case 'top3': return { positionMin: 1, positionMax: 3 };
    case 'pos1': return { positionMin: 1, positionMax: 1 };
    case '4_10': return { positionMin: 4, positionMax: 10 };
    case '11_20': return { positionMin: 11, positionMax: 20 };
    case '21_50': return { positionMin: 21, positionMax: 50 };
    case '51_100': return { positionMin: 51, positionMax: 100 };
    default: {
      if (value.startsWith('custom:')) {
        const [, a, b] = value.split(':');
        return {
          positionMin: a ? Number(a) : null,
          positionMax: b ? Number(b) : null,
        };
      }
      return { positionMin: null, positionMax: null };
    }
  }
}

export function volumeFilterValue(filters: OrganicFilters): string {
  const min = filters.volumeMin ?? null;
  const max = filters.volumeMax ?? null;
  if (min == null && max == null) return 'all';
  if (min === 100001 && max == null) return '100001+';
  if (min === 10001 && max === 100000) return '10001-100000';
  if (min === 1001 && max === 10000) return '1001-10000';
  if (min === 101 && max === 1000) return '101-1000';
  if (min === 11 && max === 100) return '11-100';
  if (min === 1 && max === 10) return '1-10';
  return `custom:${min ?? ''}:${max ?? ''}`;
}

export function volumeFilterFromValue(value: string): Pick<OrganicFilters, 'volumeMin' | 'volumeMax'> {
  switch (value) {
    case 'all': return { volumeMin: null, volumeMax: null };
    case '100001+': return { volumeMin: 100001, volumeMax: null };
    case '10001-100000': return { volumeMin: 10001, volumeMax: 100000 };
    case '1001-10000': return { volumeMin: 1001, volumeMax: 10000 };
    case '101-1000': return { volumeMin: 101, volumeMax: 1000 };
    case '11-100': return { volumeMin: 11, volumeMax: 100 };
    case '1-10': return { volumeMin: 1, volumeMax: 10 };
    default: {
      if (value.startsWith('custom:')) {
        const [, a, b] = value.split(':');
        return { volumeMin: a ? Number(a) : null, volumeMax: b ? Number(b) : null };
      }
      return { volumeMin: null, volumeMax: null };
    }
  }
}

export function kdFilterValue(filters: OrganicFilters): string {
  const min = filters.kdMin ?? null;
  const max = filters.kdMax ?? null;
  if (min == null && max == null) return 'all';
  if (min === 85 && max === 100) return 'very_hard';
  if (min === 70 && max === 84) return 'hard';
  if (min === 50 && max === 69) return 'difficult';
  if (min === 30 && max === 49) return 'possible';
  if (min === 15 && max === 29) return 'easy';
  if (min === 0 && max === 14) return 'very_easy';
  return `custom:${min ?? ''}:${max ?? ''}`;
}

export function kdFilterFromValue(value: string): Pick<OrganicFilters, 'kdMin' | 'kdMax'> {
  switch (value) {
    case 'all': return { kdMin: null, kdMax: null };
    case 'very_hard': return { kdMin: 85, kdMax: 100 };
    case 'hard': return { kdMin: 70, kdMax: 84 };
    case 'difficult': return { kdMin: 50, kdMax: 69 };
    case 'possible': return { kdMin: 30, kdMax: 49 };
    case 'easy': return { kdMin: 15, kdMax: 29 };
    case 'very_easy': return { kdMin: 0, kdMax: 14 };
    default: {
      if (value.startsWith('custom:')) {
        const [, a, b] = value.split(':');
        return { kdMin: a ? Number(a) : null, kdMax: b ? Number(b) : null };
      }
      return { kdMin: null, kdMax: null };
    }
  }
}

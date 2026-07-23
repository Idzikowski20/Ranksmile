import type { OrganicDataset, OrganicKeyword } from './types';

export type ExportFormat = 'csv' | 'json' | 'google_sheets';

export type ExportProvider = {
  format: ExportFormat;
  label: string;
  available: boolean;
  exportRows: (keywords: OrganicKeyword[], dataset?: OrganicDataset) => string | { error: string };
};

function csvEscape(v: string | number | null | undefined): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCsv(keywords: OrganicKeyword[]): string {
  const header = [
    'keyword', 'intent', 'position', 'trend', 'state', 'traffic', 'traffic_share',
    'volume', 'difficulty', 'opportunity', 'url', 'topic_id', 'updated_at',
  ].join(',');
  const lines = keywords.map((k) => [
    csvEscape(k.keyword),
    csvEscape(k.intent),
    csvEscape(k.position),
    csvEscape(k.trend),
    csvEscape(k.state),
    csvEscape(k.traffic),
    csvEscape(k.trafficShare),
    csvEscape(k.volume),
    csvEscape(k.difficulty),
    csvEscape(k.opportunityScore),
    csvEscape(k.url),
    csvEscape(k.topicId),
    csvEscape(k.updatedAt),
  ].join(','));
  return [header, ...lines].join('\n');
}

export function exportJson(keywords: OrganicKeyword[], dataset?: OrganicDataset): string {
  if (dataset) {
    return JSON.stringify({
      domain: dataset.domain,
      meta: dataset.meta,
      metrics: dataset.metrics,
      keywords,
      pages: dataset.pages,
    }, null, 2);
  }
  return JSON.stringify({ keywords }, null, 2);
}

export const exportProviders: ExportProvider[] = [
  {
    format: 'csv',
    label: 'CSV',
    available: true,
    exportRows: (keywords) => exportCsv(keywords),
  },
  {
    format: 'json',
    label: 'JSON',
    available: true,
    exportRows: (keywords, dataset) => exportJson(keywords, dataset),
  },
  {
    format: 'google_sheets',
    label: 'Google Sheets',
    available: false,
    exportRows: () => ({ error: 'Google Sheets export is coming soon' }),
  },
];

export function runExport(
  format: ExportFormat,
  keywords: OrganicKeyword[],
  dataset?: OrganicDataset,
): { ok: true; body: string; contentType: string } | { ok: false; error: string } {
  const provider = exportProviders.find((p) => p.format === format);
  if (!provider) return { ok: false, error: 'Unknown export format' };
  if (!provider.available) return { ok: false, error: 'Export format not available' };
  const body = provider.exportRows(keywords, dataset);
  if (typeof body !== 'string') return { ok: false, error: body.error };
  return {
    ok: true,
    body,
    contentType: format === 'json' ? 'application/json' : 'text/csv; charset=utf-8',
  };
}

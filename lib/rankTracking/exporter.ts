import type { ExportFormat, RankTrackingRow } from '../types/rankTracking';

function escapeCsv(val: string): string {
  if (/[",\n]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
  return val;
}

function rowToRecord(row: RankTrackingRow, device: 'desktop' | 'mobile'): Record<string, string | number | null> {
  const d = device === 'mobile' ? row.mobile : row.desktop;
  return {
    keyword: row.keyword,
    device,
    position: d.position,
    previous_position: d.previousPosition,
    found: d.found ? 1 : 0,
    url: d.rankingUrl,
    volume: row.searchVolume,
    kd: row.keywordDifficulty,
    cpc: row.cpc,
    serp_features: d.serpFeatures.join('|'),
  };
}

export function exportRankRows(
  rows: RankTrackingRow[],
  format: ExportFormat,
  devices: Array<'desktop' | 'mobile'> = ['desktop'],
): string {
  const flat: Record<string, string | number | null>[] = [];
  for (const row of rows) {
    for (const device of devices) {
      flat.push(rowToRecord(row, device));
    }
  }

  if (format === 'json') {
    return JSON.stringify(flat, null, 2);
  }

  if (!flat.length) return 'keyword,device,position,previous_position,found,url,volume,kd,cpc,serp_features\n';
  const headers = Object.keys(flat[0]);
  const lines = [
    headers.join(','),
    ...flat.map((r) => headers.map((h) => escapeCsv(String(r[h] ?? ''))).join(',')),
  ];
  return lines.join('\n');
}

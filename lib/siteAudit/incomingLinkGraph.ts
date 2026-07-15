import { parseJsonish } from '../types/json';
import type { AuditRow } from './issues';
import type { PageAuditSignals } from './types';
import { normalizeForIncoming } from './redirectScan';

function signalsOf(row: AuditRow): PageAuditSignals {
  return parseJsonish<PageAuditSignals>(row.signals_json) ?? {};
}

function isOk(row: AuditRow): boolean {
  return (row.fetch_status ?? '').toUpperCase() === 'OK';
}

export function buildIncomingLinkCounts(rows: AuditRow[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of rows) {
    if (!isOk(row)) continue;
    const key = normalizeForIncoming(row.url);
    if (!(key in counts)) counts[key] = 0;
  }

  for (const row of rows) {
    if (!isOk(row)) continue;
    const s = signalsOf(row);
    for (const href of s.outbound_internal_hrefs ?? []) {
      const target = normalizeForIncoming(href);
      counts[target] = (counts[target] ?? 0) + 1;
    }
  }

  return counts;
}

export function pagesWithSingleIncoming(counts: Record<string, number>): string[] {
  return Object.entries(counts)
    .filter(([, n]) => n === 1)
    .map(([url]) => url);
}

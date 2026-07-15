import { parseJsonish } from '../types/json';
import type { AuditRow } from './issues';
import type { PageAuditSignals, PermanentRedirectInstance } from './types';

function normalizeUrl(url: string): string {
  return url.split('#')[0].split('?')[0].replace(/\/$/, '') || url;
}

function signalsOf(row: AuditRow): PageAuditSignals {
  return parseJsonish<PageAuditSignals>(row.signals_json) ?? {};
}

export function collectPermanentRedirects(rows: AuditRow[]): PermanentRedirectInstance[] {
  const out: PermanentRedirectInstance[] = [];
  for (const row of rows) {
    const st = (row.fetch_status ?? '').toUpperCase();
    if (!st.startsWith('REDIRECT_')) continue;
    const s = signalsOf(row);
    const code = s.redirect_status ?? (st === 'REDIRECT_301' ? 301 : 302);
    if (code !== 301 && code !== 308) continue;
    const target = s.redirect_target ?? '';
    out.push({
      url: row.url,
      target,
      statusCode: code,
    });
  }
  return out;
}

export function countRedirectUrlsChecked(rows: AuditRow[]): number {
  return rows.filter((r) => {
    const st = (r.fetch_status ?? '').toUpperCase();
    return st === 'OK' || st.startsWith('REDIRECT_');
  }).length;
}

export function normalizeForIncoming(url: string): string {
  return normalizeUrl(url);
}

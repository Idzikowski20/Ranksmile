import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { parseJsonish } from '../types/json';
import { RANKSMILE_UA } from '../httpConstants';
import { assertPublicUrl } from '../ssrfGuard';
import type { AuditRow } from './issues';
import type { External403Instance, PageAuditSignals } from './types';

const CACHE_DIR = path.join(process.cwd(), 'data/cache/site-audit-external');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_PROBE = 80;
const CONCURRENCY = 6;

type CacheEntry = {
  cachedAt: string;
  results: External403Instance[];
};

function cacheKey(domain: string): string {
  return createHash('sha256').update(domain.toLowerCase()).digest('hex').slice(0, 16);
}

function readCache(domain: string): External403Instance[] | null {
  try {
    const file = path.join(CACHE_DIR, `${cacheKey(domain)}.json`);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEntry;
    if (Date.now() - new Date(raw.cachedAt).getTime() > CACHE_TTL_MS) return null;
    return raw.results;
  } catch {
    return null;
  }
}

function writeCache(domain: string, results: External403Instance[]): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${cacheKey(domain)}.json`);
    fs.writeFileSync(file, JSON.stringify({ cachedAt: new Date().toISOString(), results }, null, 2));
  } catch {
    // best-effort
  }
}

function signalsOf(row: AuditRow): PageAuditSignals {
  return parseJsonish<PageAuditSignals>(row.signals_json) ?? {};
}

function isOk(row: AuditRow): boolean {
  return (row.fetch_status ?? '').toUpperCase() === 'OK';
}

type ExternalRef = { pageUrl: string; externalUrl: string };

function collectExternalRefs(rows: AuditRow[]): ExternalRef[] {
  const refs: ExternalRef[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (!isOk(row)) continue;
    const s = signalsOf(row);
    for (const link of s.external_links ?? []) {
      const href = link.href?.trim();
      if (!href) continue;
      const key = `${row.url}::${href}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({ pageUrl: row.url, externalUrl: href });
    }
  }
  return refs.slice(0, MAX_PROBE);
}

async function probe403(externalUrl: string): Promise<boolean> {
  try {
    await assertPublicUrl(externalUrl);
    const r = await fetch(externalUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': RANKSMILE_UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (r.status === 403) return true;
    if (r.status === 405) {
      const r2 = await fetch(externalUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': RANKSMILE_UA },
        signal: AbortSignal.timeout(12_000),
      });
      return r2.status === 403;
    }
    return false;
  } catch {
    return false;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx;
      idx += 1;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function probeExternal403Links(
  domain: string,
  rows: AuditRow[],
): Promise<External403Instance[]> {
  const cached = readCache(domain);
  if (cached) return cached;

  const refs = collectExternalRefs(rows);
  const results = await mapPool(refs, CONCURRENCY, async (ref) => {
    const is403 = await probe403(ref.externalUrl);
    return is403 ? { pageUrl: ref.pageUrl, externalUrl: ref.externalUrl } : null;
  });

  const issues = results.filter((r): r is External403Instance => r !== null);
  writeCache(domain, issues);
  return issues;
}

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fetchSitemapEntries } from '../fetchSitemapUrls';
import { SERPBEAR_UA } from '../httpConstants';
import { assertPublicUrl } from '../ssrfGuard';
import type { SitemapIssueInstance } from './types';

const CACHE_DIR = path.join(process.cwd(), 'data/cache/site-audit-sitemap');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CONCURRENCY = 8;

type SitemapCheckResult = 'ok' | 'redirect' | 'non-200';

export type SitemapValidationResult = {
  issues: SitemapIssueInstance[];
  entriesChecked: number;
};

type SitemapCachePayload = {
  cachedAt: string;
  issues: SitemapIssueInstance[];
  entriesChecked?: number;
};

function cacheKey(domain: string): string {
  return createHash('sha256').update(domain.toLowerCase()).digest('hex').slice(0, 16);
}

function readCache(domain: string): SitemapValidationResult | null {
  try {
    const file = path.join(CACHE_DIR, `${cacheKey(domain)}.json`);
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as SitemapCachePayload;
    const age = Date.now() - new Date(raw.cachedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    return {
      issues: raw.issues,
      entriesChecked: raw.entriesChecked ?? raw.issues.length,
    };
  } catch {
    return null;
  }
}

function writeCache(domain: string, result: SitemapValidationResult): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const file = path.join(CACHE_DIR, `${cacheKey(domain)}.json`);
    const payload: SitemapCachePayload = {
      cachedAt: new Date().toISOString(),
      issues: result.issues,
      entriesChecked: result.entriesChecked,
    };
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  } catch {
    // cache is best-effort
  }
}

async function checkSitemapUrl(url: string): Promise<SitemapCheckResult> {
  try {
    await assertPublicUrl(url);
    const r = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': SERPBEAR_UA },
      signal: AbortSignal.timeout(12_000),
    });
    if (r.status >= 300 && r.status < 400) return 'redirect';
    if (r.status !== 200) return 'non-200';
    return 'ok';
  } catch {
    return 'non-200';
  }
}

function issueTypeLabel(result: SitemapCheckResult): string {
  if (result === 'redirect') return 'Redirect';
  return 'Non-200';
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
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

export async function validateSitemapIssues(domain: string): Promise<SitemapValidationResult> {
  const cached = readCache(domain);
  if (cached) return cached;

  const entries = await fetchSitemapEntries(domain);
  if (!entries.length) {
    const empty = { issues: [], entriesChecked: 0 };
    writeCache(domain, empty);
    return empty;
  }

  const results = await mapPool(entries, CONCURRENCY, async (entry) => ({
    entry,
    result: await checkSitemapUrl(entry.url),
  }));

  const issues: SitemapIssueInstance[] = [];
  for (const { entry, result } of results) {
    if (result === 'ok') continue;
    issues.push({
      sitemapUrl: entry.sitemapUrl,
      linkUrl: entry.url,
      issueType: issueTypeLabel(result),
    });
  }

  const payload = { issues, entriesChecked: entries.length };
  writeCache(domain, payload);
  return payload;
}

/** Prefer validateSitemapIssues().entriesChecked — kept for callers that only need a count. */
export async function countSitemapUrlsChecked(domain: string, issueCount: number): Promise<number> {
  const result = await validateSitemapIssues(domain);
  return result.entriesChecked || issueCount;
}

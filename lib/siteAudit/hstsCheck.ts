import { SERPBEAR_UA } from '../httpConstants';
import { assertPublicUrl } from '../ssrfGuard';
import type { HstsMissingInstance } from './types';

const PROBE_TIMEOUT_MS = 10_000;

async function hasHsts(url: string): Promise<boolean> {
  try {
    await assertPublicUrl(url);
    const r = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': SERPBEAR_UA },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const hsts = r.headers.get('strict-transport-security');
    return Boolean(hsts && hsts.trim().length > 0);
  } catch {
    return false;
  }
}

function subdomainHosts(domain: string, crawledHosts: Set<string>): string[] {
  const base = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
  const candidates = new Set<string>([base, `www.${base}`]);
  for (const h of crawledHosts) {
    if (h.endsWith(`.${base}`) || h === base) {
      candidates.add(h);
    }
  }
  return [...candidates];
}

export function extractHostsFromRows(urls: string[]): Set<string> {
  const hosts = new Set<string>();
  for (const u of urls) {
    try {
      hosts.add(new URL(u).host.toLowerCase());
    } catch {
      // skip invalid
    }
  }
  return hosts;
}

export async function checkHstsMissing(
  domain: string,
  crawledUrls: string[],
): Promise<HstsMissingInstance[]> {
  const hosts = extractHostsFromRows(crawledUrls);
  const subdomains = subdomainHosts(domain, hosts);
  const missing: HstsMissingInstance[] = [];

  await Promise.all(
    subdomains.map(async (host) => {
      const ok = await hasHsts(`https://${host}/`);
      if (!ok) missing.push({ subdomain: host });
    }),
  );

  return missing.sort((a, b) => a.subdomain.localeCompare(b.subdomain));
}

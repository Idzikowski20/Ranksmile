import { assertPublicUrl } from './ssrfGuard';

/** Validate user/DFS-derived URLs before server-side fetch (SSRF-safe). */
export async function safeUrl(raw: string): Promise<URL> {
  return assertPublicUrl(raw);
}

/** Parse http(s) URL without DNS — for display/normalization only, not fetch. */
export function parseHttpUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

export function normalizeCitationUrl(raw: string): string | null {
  const u = parseHttpUrl(raw.trim());
  return u?.href ?? null;
}

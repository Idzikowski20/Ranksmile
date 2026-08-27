/** Grounding / redirect proxies from DataForSEO — not real sources or competitors. */
export const BLOCKED_CITATION_DOMAINS: readonly string[] = [
  'vertexaisearch.cloud.google.com',
  'googleusercontent.com',
  'google.com',
  'gstatic.com',
  'bing.com',
  'duckduckgo.com',
];

const BLOCKED = new Set(BLOCKED_CITATION_DOMAINS);

export function normCitationDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, '');
}

export function isBlockedCitationDomain(domain: string): boolean {
  const d = normCitationDomain(domain);
  if (!d) return true;
  if (BLOCKED.has(d)) return true;
  if (d.endsWith('.vertexaisearch.cloud.google.com')) return true;
  return false;
}

function isBlockedCitationUrl(url: string): boolean {
  try {
    return isBlockedCitationDomain(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Drop AI-grounding proxy citations before persistence or aggregation. */
export function filterCitations<T extends { domain: string; url?: string }>(citations: T[]): T[] {
  return citations.filter((c) => {
    if (isBlockedCitationDomain(c.domain)) return false;
    if (c.url && isBlockedCitationUrl(c.url)) return false;
    return true;
  });
}

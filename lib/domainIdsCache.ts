import TTLCache from '@isaacs/ttlcache';

/**
 * Workspace→domain-ID cache for the articles API (see pages/api/articles/index.ts).
 * Lives in lib/ so domain-mutating endpoints can invalidate it without importing a
 * pages module. TTL bounds staleness even for mutation paths nobody wired up.
 */
export const domainIdsCache = new TTLCache<string, number[]>({ max: 500, ttl: 30_000 });

/** Call after any domain create/delete/workspace-move so authz reflects it immediately. */
export function clearDomainIdsCache(): void {
  domainIdsCache.clear();
}

import { queryRows } from './db/query';
import { scanCompetitors } from './competitorScan';
import { ensureCompetitorsTables } from './ensureCompetitorsTables';

// Pre-scan competitors for at most this many of the domain's top keywords at setup.
// Each scan is a sidecar /competitor-outlines call (+ DataForSEO rank), so this is
// capped and best-effort — it never blocks or fails domain setup.
const MAX_KEYWORDS = 10;

/**
 * After domain setup, populate the shared Organic Competitors store for the domain's
 * top keywords so they're ready in the modal without an on-demand scan. Sequential +
 * swallowed errors; fire-and-forget from the setup webhook.
 */
export async function prescanDomainCompetitors(domainId: number): Promise<void> {
   await ensureCompetitorsTables();
   const rows = await queryRows<{ keyword: string }>(
      'SELECT keyword FROM domain_keywords WHERE domain_id = ? ORDER BY COALESCE(volume, 0) DESC LIMIT ?',
      [domainId, MAX_KEYWORDS],
   ).catch(() => []);
   for (const r of rows) {
      if (!r.keyword) continue;
      try { await scanCompetitors(domainId, r.keyword); } catch { /* best-effort */ }
   }
}

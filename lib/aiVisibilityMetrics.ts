/**
 * Pure aggregation for AI Visibility — shared by the scan runner and the read API.
 *
 * Scoring (locked so UI and API agree):
 *   pairScore(prompt,model) = cited@pos1 → 100; pos p → max(0, 100-(p-1)*15); not cited → 0
 *   visibilityScore = round(mean of pairScore over all (prompt,model) pairs)
 *   mentionRate     = % of pairs where the brand was cited
 *   avgPosition     = mean own_position over cited pairs (1 dp); null if never cited
 *   directCitations = count of own-domain citation entries; pages = distinct own URLs
 */
import type { LlmCitation } from './dataforseoLlm';

export type ResultRow = {
   promptId: number,
   model: string,
   ownCited: boolean,
   ownPosition: number | null,
   citations: LlmCitation[],
};

const norm = (d: string): string => d.toLowerCase().replace(/^www\./, '');

export function ownDomainPosition(citations: LlmCitation[], ownDomain: string): number | null {
   const own = norm(ownDomain);
   if (!own) return null;
   const idx = citations.findIndex((c) => norm(c.domain) === own || norm(c.domain).endsWith(`.${own}`));
   return idx === -1 ? null : idx + 1;
}

const pairScore = (r: ResultRow): number => (
   r.ownCited && r.ownPosition ? Math.max(0, 100 - (r.ownPosition - 1) * 15) : 0
);

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function computeOverview(rows: ResultRow[]) {
   const perModelMap = new Map<string, number[]>();
   for (const r of rows) {
      const list = perModelMap.get(r.model) ?? [];
      list.push(pairScore(r));
      perModelMap.set(r.model, list);
   }
   const scores = rows.map(pairScore);
   const cited = rows.filter((r) => r.ownCited && r.ownPosition);

   // Own URL/citation counting derives from ownPosition (the citation at that
   // 1-based index is the brand's), NOT from re-matching domains.
   const ownUrls = new Set<string>();
   let directCitations = 0;
   for (const r of rows) {
      if (!r.ownCited || !r.ownPosition) continue;
      const c = r.citations[r.ownPosition - 1];
      if (c) { directCitations += 1; ownUrls.add(c.url); }
   }

   return {
      visibilityScore: Math.round(mean(scores)),
      mentionRate: rows.length ? Math.round((cited.length / rows.length) * 100) : 0,
      avgPosition: cited.length ? Math.round(mean(cited.map((r) => r.ownPosition as number)) * 10) / 10 : null,
      directCitations,
      pages: ownUrls.size,
      perModel: Array.from(perModelMap.entries()).map(([model, list]) => ({ model, score: Math.round(mean(list)) })),
   };
}

export function aggregateSources(rows: ResultRow[]) {
   const byUrl = new Map<string, { url: string, domain: string, timesShown: number, models: Set<string> }>();
   for (const r of rows) {
      for (const c of r.citations) {
         const entry = byUrl.get(c.url) ?? { url: c.url, domain: norm(c.domain), timesShown: 0, models: new Set<string>() };
         entry.timesShown += 1;
         entry.models.add(r.model);
         byUrl.set(c.url, entry);
      }
   }
   return Array.from(byUrl.values())
      .sort((a, b) => b.timesShown - a.timesShown)
      .map((e) => ({ url: e.url, domain: e.domain, timesShown: e.timesShown, models: Array.from(e.models) }));
}

export function aggregateCompetitors(rows: ResultRow[], ownDomain: string) {
   const own = norm(ownDomain);
   const byDomain = new Map<string, number>();
   let total = 0;
   for (const r of rows) {
      for (const c of r.citations) {
         const d = norm(c.domain);
         if (!d || d === own || d.endsWith(`.${own}`)) continue;
         byDomain.set(d, (byDomain.get(d) ?? 0) + 1);
         total += 1;
      }
   }
   return Array.from(byDomain.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([domain, mentions]) => ({ domain, mentions, share: total ? Math.round((mentions / total) * 100) : 0 }));
}

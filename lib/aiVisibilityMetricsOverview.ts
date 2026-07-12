import type { LlmCitation } from './dataforseoLlm';
import type { ResultRow } from './aiVisibilityMetricsTypes';

const pairScore = (r: ResultRow): number => (
  r.ownCited && r.ownPosition ? Math.max(0, 100 - (r.ownPosition - 1) * 15) : 0
);

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const norm = (d: string): string => d.toLowerCase().replace(/^www\./, '');

export function ownDomainPosition(citations: LlmCitation[], ownDomain: string): number | null {
  const own = norm(ownDomain);
  if (!own) return null;
  const idx = citations.findIndex((c) => norm(c.domain) === own || norm(c.domain).endsWith(`.${own}`));
  return idx === -1 ? null : idx + 1;
}

export function computeOverview(rows: ResultRow[]) {
  const perModelMap = new Map<string, number[]>();
  for (const r of rows) {
    const list = perModelMap.get(r.model) ?? [];
    list.push(pairScore(r));
    perModelMap.set(r.model, list);
  }
  const scores = rows.map(pairScore);
  const cited = rows.filter((r) => r.ownCited && r.ownPosition);

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

export function isOwnDomainCitation(citationDomain: string, ownDomain: string): boolean {
  const own = norm(ownDomain);
  if (!own) return false;
  const d = norm(citationDomain);
  return d === own || d.endsWith(`.${own}`);
}

export { norm, pairScore, mean };

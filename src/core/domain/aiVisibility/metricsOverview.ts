import type { LlmCitation } from './citation';
import type { ResultRow } from './metricsTypes';
// Single source of host normalization — shared with citation blocking so the two
// never drift on the same input.
import { normCitationDomain as norm } from './blockedDomains';
import { presenceScore } from './presence';

const pairScore = (r: ResultRow): number => (
  r.ownCited && r.ownPosition ? Math.max(0, 100 - (r.ownPosition - 1) * 15) : 0
);

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function ownDomainPosition(citations: LlmCitation[], ownDomain: string): number | null {
  const own = norm(ownDomain);
  if (!own) return null;
  const idx = citations.findIndex((c) => norm(c.domain) === own || norm(c.domain).endsWith(`.${own}`));
  return idx === -1 ? null : idx + 1;
}

/** mentionRate (%) + avgPosition for a set of pairs, the two inputs presence is built on. */
function rateAndPosition(rows: ResultRow[]): { mentionRate: number; avgPosition: number | null } {
  const cited = rows.filter((r) => r.ownCited && r.ownPosition);
  return {
    mentionRate: rows.length ? Math.round((cited.length / rows.length) * 100) : 0,
    avgPosition: cited.length ? Math.round(mean(cited.map((r) => r.ownPosition as number)) * 10) / 10 : null,
  };
}

export function computeOverview(rows: ResultRow[]) {
  const perModelMap = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const list = perModelMap.get(r.model) ?? [];
    list.push(r);
    perModelMap.set(r.model, list);
  }
  const cited = rows.filter((r) => r.ownCited && r.ownPosition);
  const { mentionRate, avgPosition } = rateAndPosition(rows);

  const ownUrls = new Set<string>();
  let directCitations = 0;
  for (const r of rows) {
    if (!r.ownCited || !r.ownPosition) continue;
    const c = r.citations[r.ownPosition - 1];
    if (c) { directCitations += 1; ownUrls.add(c.url); }
  }

  return {
    // One calibrated model for every surface (own gauge, per-engine, brand profiles) so the
    // numbers stay comparable with the reference tool — see domain/aiVisibility/presence.
    visibilityScore: presenceScore({ mentionRate, avgPosition }),
    mentionRate,
    avgPosition,
    directCitations,
    pages: ownUrls.size,
    perModel: Array.from(perModelMap.entries()).map(([model, list]) => ({
      model,
      score: presenceScore(rateAndPosition(list)),
    })),
  };
}

export function isOwnDomainCitation(citationDomain: string, ownDomain: string): boolean {
  const own = norm(ownDomain);
  if (!own) return false;
  const d = norm(citationDomain);
  return d === own || d.endsWith(`.${own}`);
}

export { pairScore, mean };

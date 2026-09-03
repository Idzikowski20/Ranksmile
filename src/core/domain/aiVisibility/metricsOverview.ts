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

/** Brand names compare on letters and digits only: "Pro Detektyw" === "ProDetektyw".
 *  Unicode-aware on purpose — an ASCII class erases a brand like "Żółw" to nothing, and
 *  an empty key silently scores every answer as "brand not named". */
export const brandKey = (s: string): string => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** 1-based appearance position of the tracked brand in an answer, or null if unnamed. */
export function ownBrandPosition(row: ResultRow, ownBrand: string): number | null {
  const want = brandKey(ownBrand);
  if (!want) return null;
  const hit = row.brands.find((b) => brandKey(b.brand) === want);
  return hit ? hit.pos : null;
}

/** The three numbers the brand metric reports, before the per-model split. */
export type BrandTriad = { visibilityScore: number; mentionRate: number; avgPosition: number | null };

export type BrandOverview = {
  visibilityScore: number;
  mentionRate: number;
  avgPosition: number | null;
  mentions: number;
  pairs: number;
  perModel: Array<{ model: string; score: number }>;
};

/** Rate + position of the tracked BRAND over the answers whose brands are extracted. */
function brandRateAndPosition(
  rows: ResultRow[],
  ownBrand: string,
): { mentionRate: number; avgPosition: number | null; mentions: number; pairs: number } {
  // A row whose brands column is still NULL has not been through the extraction phase —
  // counting it as "not mentioned" would understate the rate while that phase runs, so it
  // is left out of the denominator and the rate converges as extraction progresses.
  const scored = rows.filter((r) => r.brandsAnalyzed !== false);
  const positions = scored.map((r) => ownBrandPosition(r, ownBrand)).filter((p): p is number => p != null);
  return {
    mentions: positions.length,
    pairs: scored.length,
    // Kept to one decimal, like the reference tool — a 30-answer scan moves in 3.3% steps.
    mentionRate: scored.length ? Math.round((positions.length / scored.length) * 1000) / 10 : 0,
    avgPosition: positions.length ? Math.round(mean(positions) * 10) / 10 : null,
  };
}

/**
 * The tracked brand's own headline metric: how often the ANSWERS NAME THE BRAND and where
 * in the answer, which is what the reference tool reports and what the brand rows in
 * Competitors are scored on. Distinct from computeOverview, which measures citations of a
 * DOMAIN and stays the basis of the per-domain snapshots, source overlap and gap views.
 */
export function computeBrandOverview(rows: ResultRow[], ownBrand: string): BrandOverview {
  const perModelMap = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const list = perModelMap.get(r.model) ?? [];
    list.push(r);
    perModelMap.set(r.model, list);
  }
  const { mentionRate, avgPosition, mentions, pairs } = brandRateAndPosition(rows, ownBrand);
  return {
    visibilityScore: presenceScore({ mentionRate, avgPosition }),
    mentionRate,
    avgPosition,
    mentions,
    pairs,
    perModel: Array.from(perModelMap.entries()).map(([model, list]) => ({
      model,
      score: presenceScore(brandRateAndPosition(list, ownBrand)),
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

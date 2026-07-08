/**
 * Client-safe salience scoring helpers (no cheerio).
 */
import type { NlpTerm } from './contentScore';
import { countOccurrences } from './termMatch';

export type SalienceZones = {
  headings: string;
  bold: string;
  body: string;
};

/** 0–100 salience from heading/bold prominence vs body frequency across competitor pages. */
export function computeTermSalienceScore(term: string, zonesList: SalienceZones[]): number {
  if (!term || !zonesList.length) return 0;

  let headingHits = 0;
  let boldHits = 0;
  let bodyHits = 0;
  let docsWithSalient = 0;

  for (const z of zonesList) {
    const h = countOccurrences(z.headings, term);
    const b = countOccurrences(z.bold, term);
    const body = countOccurrences(z.body, term);
    headingHits += h;
    boldHits += b;
    bodyHits += body;
    if (h > 0 || b > 0) docsWithSalient += 1;
  }

  const docRate = docsWithSalient / zonesList.length;
  const zoneIntensity = (headingHits * 2 + boldHits * 1.5) / Math.max(1, bodyHits);
  const raw = 0.45 * docRate + 0.55 * Math.min(1, zoneIntensity);
  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

/** Attach salience + relevance; lightly boost target for prominently used terms. */
export function enrichTermsWithSalienceFromZones(terms: NlpTerm[], zonesList: SalienceZones[]): NlpTerm[] {
  if (!terms.length || !zonesList.length) return terms;

  return terms.map((t) => {
    const salience = computeTermSalienceScore(t.term, zonesList);
    const baseTarget = t.target_count ?? 1;
    const boostedTarget = salience >= 70
      ? Math.max(baseTarget, Math.ceil(baseTarget * 1.15))
      : baseTarget;

    return {
      ...t,
      salience,
      relevance: salience / 100,
      target_count: boostedTarget,
      suggested_max: t.suggested_max != null
        ? Math.max(t.suggested_max, boostedTarget)
        : t.suggested_max,
    };
  });
}

/** Scoring weight — low-salience terms still count, high-salience terms count more. */
export function termSalienceWeight(term: { salience?: number; relevance?: number }): number {
  const salience = term.salience ?? (term.relevance != null ? Math.round(term.relevance * 100) : 50);
  return 0.5 + salience / 100;
}

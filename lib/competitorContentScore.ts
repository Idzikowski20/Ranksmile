/**
 * Client-safe Surfer-style competitor content scoring (no Node/network deps).
 * Server fetch + HTML parsing lives in auditCompute / competitorAuditScore.
 */
import { countOccurrences } from './termMatch';
import { termSalienceWeight } from './termSalienceCore';

export interface RichTerm {
  term: string;
  target_count: number;
  type?: string;
  relevance?: number;
  doc_freq?: number;
  suggested_min?: number;
  suggested_max?: number;
  salience?: number;
  searchVolume?: number | null;
}

export type CompetitorScoreTargets = {
  avgWords: number;
  avgHeadings: number;
  avgPs: number;
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** 60% term coverage + 25% word depth vs peers + 15% structure. */
export function auditContentScore(coverageFrac: number, wordFrac: number, structFrac: number): number {
  return Math.round((0.6 * clamp01(coverageFrac) + 0.25 * clamp01(wordFrac) + 0.15 * clamp01(structFrac)) * 100);
}

export function termCoverageFraction(bodyText: string, terms: { term: string }[]): number {
  if (!terms.length) return 0;
  const covered = terms.filter((t) => countOccurrences(bodyText, t.term) >= 1).length;
  return covered / terms.length;
}

function termRangeScore(you: number, sMin: number, sMax: number): number {
  if (you >= sMin && you <= sMax) return 1;
  if (you === 0) return 0;
  if (you < sMin) return Math.min(0.85, you / Math.max(sMin, 1));
  return 0.7;
}

export function termRangeCoverageFraction(
  bodyText: string,
  terms: Array<{ term: string; suggested_min?: number; suggested_max?: number; target_count?: number; salience?: number; relevance?: number }>,
): number {
  if (!terms.length) return 0;
  let weightSum = 0;
  let scoreSum = 0;
  for (const t of terms) {
    const w = termSalienceWeight(t);
    const you = countOccurrences(bodyText, t.term);
    const sMin = Math.max(0, t.suggested_min ?? Math.max(1, Math.round((t.target_count ?? 1) * 0.7)));
    const sMax = Math.max(sMin, t.suggested_max ?? Math.max(sMin, t.target_count ?? 1));
    scoreSum += termRangeScore(you, sMin, sMax) * w;
    weightSum += w;
  }
  return weightSum > 0 ? scoreSum / weightSum : 0;
}

export function termScoreFraction(bodyText: string, terms: RichTerm[]): number {
  if (!terms.length) return 0;
  const ranged = terms.filter((t) => t.suggested_min != null || t.suggested_max != null);
  if (ranged.length) return termRangeCoverageFraction(bodyText, ranged);
  return termCoverageFraction(bodyText, terms);
}

export function computeCompetitorContentScore(
  bodyText: string,
  wordCount: number,
  headingCount: number,
  paragraphCount: number,
  terms: RichTerm[],
  targets: CompetitorScoreTargets,
): number {
  const cov = terms.length ? termScoreFraction(bodyText, terms) : 0;
  const wordFrac = targets.avgWords > 0 ? wordCount / targets.avgWords : 0;
  const structFrac = (
    (targets.avgHeadings > 0 ? Math.min(1, headingCount / targets.avgHeadings) : 0)
    + (targets.avgPs > 0 ? Math.min(1, paragraphCount / targets.avgPs) : 0)
  ) / 2;
  return auditContentScore(cov, wordFrac, structFrac);
}

/**
 * Gap Detection — high-level research gaps from coverage + BM25 + organic mapping.
 */
import type { CoverageItem } from '../aiCoverage';
import { runGapEngine, type CoverageGap } from '../engines/gapEngine';
import { bm25Rank } from '../harvest/bm25';

export type ResearchGap = {
  id: string;
  label: string;
  kind: 'coverage' | 'semantic' | 'organic';
  score: number;
  evidence: string[];
};

export function detectResearchGaps(opts: {
  items: readonly CoverageItem[];
  plainText?: string;
  organicQueries?: string[];
}): { gaps: ResearchGap[]; coverageGaps: CoverageGap[] } {
  const coverage = runGapEngine({ items: opts.items, plainText: opts.plainText });
  const gaps: ResearchGap[] = coverage.gaps.slice(0, 20).map((g) => ({
    id: g.itemId,
    label: g.label,
    kind: 'coverage' as const,
    score: Math.round(g.informationGain * 100),
    evidence: g.evidence.map((e) => e.detail),
  }));

  if (opts.organicQueries?.length && opts.plainText) {
    const docs = [{ id: 'article', text: opts.plainText }];
    for (const q of opts.organicQueries.slice(0, 30)) {
      const hits = bm25Rank({ query: q, docs, limit: 1 });
      const score = hits[0]?.score ?? 0;
      if (score < 1.5) {
        gaps.push({
          id: `organic-${q.slice(0, 40)}`,
          label: q,
          kind: 'organic',
          score: Math.round(Math.max(0, 50 - score * 10)),
          evidence: ['Low BM25 match vs article — organic query under-covered'],
        });
      }
    }
  }

  gaps.sort((a, b) => b.score - a.score);
  return { gaps, coverageGaps: coverage.gaps };
}

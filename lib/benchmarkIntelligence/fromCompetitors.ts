import type { CompetitorRawInput } from '../contentPlanner/competitorIntelligence';
import type { BenchmarkDocInput } from './types';

/** Map planner competitor rows → Benchmark Intelligence docs. */
export function benchmarkDocsFromCompetitors(competitors: CompetitorRawInput[]): BenchmarkDocInput[] {
  return competitors.map((c) => {
    const h2 = typeof c.headings === 'number' ? c.headings : 0;
    const words = c.wordCount || 0;
    const paragraphs = c.paragraphs || 0;
    const sectionLen = h2 > 0 && words > 0 ? Math.round(words / h2) : words || 200;
    return {
      wordCount: words,
      h2,
      faq: c.faq || 0,
      tables: c.tables || 0,
      lists: c.lists || 0,
      images: c.images || 0,
      examples: Math.max(0, Math.round((c.claims?.length || 0) * 0.3)),
      citations: Math.max(0, Math.round((c.claims?.length || 0) * 0.5)),
      sectionLens: h2 > 0 ? Array.from({ length: h2 }, () => sectionLen) : [sectionLen],
      introLen: Math.min(200, Math.round(words * 0.05) || 80),
      paragraphLens: paragraphs > 0
        ? Array.from({ length: Math.min(paragraphs, 40) }, () =>
          Math.max(30, Math.round(words / Math.max(paragraphs, 1))))
        : [40],
    };
  });
}

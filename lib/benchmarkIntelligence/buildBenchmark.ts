import { distributionFrom, flattenLengths } from './distributions';
import type { BenchmarkDocInput, StructuralBenchmark } from './types';

export function buildStructuralBenchmark(docs: BenchmarkDocInput[]): StructuralBenchmark {
  const sectionLens = flattenLengths(docs.map((d) => d.sectionLens));
  const paragraphLens = flattenLengths(docs.map((d) => d.paragraphLens));
  return {
    words: distributionFrom(docs.map((d) => d.wordCount)),
    h2: distributionFrom(docs.map((d) => d.h2)),
    faq: distributionFrom(docs.map((d) => d.faq)),
    tables: distributionFrom(docs.map((d) => d.tables)),
    lists: distributionFrom(docs.map((d) => d.lists)),
    images: distributionFrom(docs.map((d) => d.images)),
    examples: distributionFrom(docs.map((d) => d.examples)),
    citations: distributionFrom(docs.map((d) => d.citations)),
    sectionLength: distributionFrom(sectionLens),
    introLength: distributionFrom(docs.map((d) => d.introLen)),
    paragraphLength: distributionFrom(paragraphLens),
    competitorCount: docs.length,
  };
}

import { BENCHMARK_H2_FLOOR, BENCHMARK_WORDS_FLOOR } from '../contentPlanner/types';
import { h2FromWords } from '../contentPlanner/competitorBenchmark';
import type { PlannerTargets, StructuralBenchmark } from './types';

/** Median-first targets; p75 as soft ceiling. */
export function toPlannerTargets(b: StructuralBenchmark): PlannerTargets {
  const words = Math.max(BENCHMARK_WORDS_FLOOR, b.words.median || b.words.mean || BENCHMARK_WORDS_FLOOR);
  // `b.h2` is a count of all headings on the page, not of top-level sections — median 22
  // for this SERP. Taken as the section target it produced 22 H2 of ~100 words each, and
  // a brief long enough to be cut off by the model's output cap. Capped by word budget.
  const h2 = Math.min(
    Math.max(BENCHMARK_H2_FLOOR, b.h2.median || b.h2.mean || BENCHMARK_H2_FLOOR),
    h2FromWords(words),
  );
  return {
    words,
    h2,
    faq: Math.max(5, b.faq.median || 5),
    tables: Math.max(1, b.tables.median || 1),
    lists: Math.max(8, b.lists.median || 8),
    images: Math.max(2, b.images.median || 2),
    examples: Math.max(4, b.examples.median || 4),
    citations: Math.max(6, b.citations.median || 6),
    wordsSoftCeiling: Math.max(words, b.words.p75 || words),
    // p75 of the same all-headings count would undo the cap above.
    h2SoftCeiling: h2,
  };
}

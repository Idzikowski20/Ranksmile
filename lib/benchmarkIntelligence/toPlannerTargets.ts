import { BENCHMARK_H2_FLOOR, BENCHMARK_WORDS_FLOOR } from '../contentPlanner/types';
import type { PlannerTargets, StructuralBenchmark } from './types';

/** Median-first targets; p75 as soft ceiling. */
export function toPlannerTargets(b: StructuralBenchmark): PlannerTargets {
  const words = Math.max(BENCHMARK_WORDS_FLOOR, b.words.median || b.words.mean || BENCHMARK_WORDS_FLOOR);
  const h2 = Math.max(BENCHMARK_H2_FLOOR, b.h2.median || b.h2.mean || BENCHMARK_H2_FLOOR);
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
    h2SoftCeiling: Math.max(h2, b.h2.p75 || h2),
  };
}

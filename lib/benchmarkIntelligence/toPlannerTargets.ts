import { BENCHMARK_H2_FLOOR, BENCHMARK_WORDS_FLOOR } from '../contentPlanner/types';
import type { PlannerTargets, StructuralBenchmark } from './types';

// The reference tool ships ~14 H2 for a ~1100-word SERP and up to the high-20s of total
// headings (H2+H3). Two knobs bound the section target between the benchmark and sanity:
//   MIN_WORDS_PER_H2 — a section shorter than this reads as fragmentation, so the word
//     budget caps the count (1080 words → at most ~14 sections).
//   H2_HARD_MAX — the upper heading band the reference stays under; also the point past
//     which one brief call would not fit the model's output cap.
const MIN_WORDS_PER_H2 = 75;
const H2_HARD_MAX = 16;

/** Median-first targets; p75 as soft ceiling. */
export function toPlannerTargets(b: StructuralBenchmark): PlannerTargets {
  // The floor applies only when the scrape measured nothing. As `Math.max(floor, median)`
  // it overrode real data instead: this SERP's median is 920 words, so every run asked for
  // the floor regardless of what the competitors actually publish — and since section
  // count derives from the word budget, it also bought sections nobody had material for.
  // p75, not the median. The median is "as long as the middle result", which is not a
  // target that outranks anything — and the reference tool aims higher still: for this
  // SERP (median 920, p75 1080, max 1440) it asked for 1400-1610, i.e. the top of the
  // field. p75 is the outlier-resistant step in that direction; `max` would let one
  // 15,000-word competitor define the brief.
  const measuredWords = b.words.p75 || b.words.median || b.words.mean || 0;
  const words = measuredWords > 0 ? measuredWords : BENCHMARK_WORDS_FLOOR;
  // `b.h2` counts all headings on the page (H2-H6), so the benchmark median already
  // approximates the reference tool's H2 section count for this SERP (median 13 here).
  // Trust it, bounded by the word budget and the hard max — an earlier `h2FromWords` cap
  // crushed 13 to 7 and shipped half the sections a competitive outline needs.
  const measuredH2 = b.h2.median || b.h2.mean || 0;
  const wordBudgetH2 = Math.max(BENCHMARK_H2_FLOOR, Math.floor(words / MIN_WORDS_PER_H2));
  const h2 = Math.min(
    H2_HARD_MAX,
    Math.max(BENCHMARK_H2_FLOOR, Math.round(measuredH2 > 0 ? measuredH2 : BENCHMARK_H2_FLOOR)),
    wordBudgetH2,
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

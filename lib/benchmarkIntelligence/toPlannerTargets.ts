import { BENCHMARK_H2_FLOOR, BENCHMARK_WORDS_FLOOR } from '../contentPlanner/types';
import type { PlannerTargets, StructuralBenchmark } from '@/src/core/domain/benchmark/types';

/**
 * Calibrated against the reference tool on one measured SERP.
 *
 * For "prywatny detektyw warszawa" the scrape gives median 920, p75 1080, max 1440 — and
 * the reference tool asks for 1400-1610 words across the seven H2 its own article ships.
 * So its target is the top of the field, not the middle of it: 1400 is our max, and 1610
 * is that max plus a tenth. Median and p75 both plan an article shorter than the longest
 * page already ranking, which outranks nothing.
 */
// Cap on how far the longest competitor may pull the target: one 15,000-word outlier
// must not define the brief, which is the failure `max` alone invites.
const MAX_VS_MEDIAN = 2;
const SOFT_CEILING_RATIO = 1.12;
/**
 * Words per H2. The reference article runs 1452 words over seven H2 — 207 each.
 *
 * This is the knob that decides section count, and 75 was far too low: it planned twelve
 * sections of ~77 words for a 920-word article, a budget no model can write to, so the
 * writer ignored it entirely and shipped 3812 words. Sections long enough to be worth
 * writing are also sections the word budget can hold.
 */
const MIN_WORDS_PER_H2 = 200;
/** Safety rail only; the word budget is what normally decides the count. */
const H2_HARD_MAX = 16;

/** Top-of-field targets, matched to the reference tool's own recommendation. */
export function toPlannerTargets(b: StructuralBenchmark): PlannerTargets {
  // The floor applies only when the scrape measured nothing. As `Math.max(floor, …)` it
  // overrode real data instead, asking for the floor regardless of what the competitors
  // actually publish — and since section count derives from the word budget, it also
  // bought sections nobody had material for.
  const median = b.words.median || b.words.mean || 0;
  const measuredWords = Math.min(b.words.max || median, (median || 0) * MAX_VS_MEDIAN) || median;
  const words = measuredWords > 0 ? measuredWords : BENCHMARK_WORDS_FLOOR;

  // `b.h2` counts every heading level (H2-H6), so on an H3-heavy SERP it is far larger
  // than the number of top-level sections an article should have — taking it literally
  // asked for sixteen. The word budget is the honest constraint: a section has to be
  // long enough to say something, and the reference article's seven H2 fall straight out
  // of 1440/200. The measured count only pulls the number DOWN, never up.
  const measuredH2 = b.h2.median || b.h2.mean || 0;
  // floor, not round: rounding up puts the average section under MIN_WORDS_PER_H2 and
  // contradicts the invariant this constant exists to state (1500/200 -> 8 sections of 187).
  const wordBudgetH2 = Math.max(BENCHMARK_H2_FLOOR, Math.floor(words / MIN_WORDS_PER_H2));
  const h2 = Math.min(
    H2_HARD_MAX,
    wordBudgetH2,
    Math.max(BENCHMARK_H2_FLOOR, Math.round(measuredH2 > 0 ? measuredH2 : BENCHMARK_H2_FLOOR)),
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
    // Calibrated on the reference tool's own upper bound: 1440 * 1.12 = 1613 against its
    // 1610. (Its own 1400->1610 is a wider 1.15, measured from a lower target.)
    wordsSoftCeiling: Math.round(words * SOFT_CEILING_RATIO),
    // p75 of the same all-headings count would undo the cap above.
    h2SoftCeiling: h2,
  };
}

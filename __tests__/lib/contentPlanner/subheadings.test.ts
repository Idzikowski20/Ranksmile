/** @jest-environment node */
/**
 * H3 density per section.
 *
 * Measured against the cohort the scorer grades us on: ~1307 words across ~14 content
 * headings — the SERP analyzer strips nav/footer/header/aside first, so that is body
 * structure, ~93 words per heading. h2FromWords keeps top-level sections at ~230 words on
 * purpose (padding to competitor heading counts produced eleven thin H2s where the
 * reference tool briefs eight), so the only way to reach that density is to nest.
 * Nothing in the planner or the writer emitted an H3 before.
 */
import { subheadingsForSection, h2FromWords } from '@/src/core/domain/contentPlanner/competitorBenchmark';

describe('subheadingsForSection', () => {
  it('leaves short sections flat', () => {
    // ~140 words is what a nine-section, 1264-word article actually shipped; splitting
    // that yields 70-word stubs, below anything the SERP does.
    expect(subheadingsForSection(140)).toBe(0);
    expect(subheadingsForSection(189)).toBe(0);
  });

  it('splits a planner-sized section once', () => {
    // h2FromWords hands out ~218-word sections for a 1300-word budget; two ~109-word
    // subsections are still more generous than the cohort's 93.
    expect(subheadingsForSection(190)).toBe(1);
    expect(subheadingsForSection(218)).toBe(1);
    expect(subheadingsForSection(240)).toBe(1);
  });

  it('scales with length but never turns a section into a list of sections', () => {
    expect(subheadingsForSection(300)).toBe(2);
    expect(subheadingsForSection(380)).toBe(3);
    expect(subheadingsForSection(600)).toBe(3);
    expect(subheadingsForSection(5000)).toBe(3);
  });

  it('never splits below the measured minimum subsection length', () => {
    for (let words = 0; words <= 1200; words += 7) {
      const subs = subheadingsForSection(words);
      if (subs > 0) expect(words / (subs + 1)).toBeGreaterThanOrEqual(95);
    }
  });

  it('rejects garbage input instead of producing NaN sections', () => {
    expect(subheadingsForSection(Number.NaN)).toBe(0);
    expect(subheadingsForSection(Number.POSITIVE_INFINITY)).toBe(0);
    expect(subheadingsForSection(-500)).toBe(0);
  });

  it('lands a nested article near the competitor heading count', () => {
    // 1307 words planned by h2FromWords, then nested: 1 H1 + 6 H2 + 6 H3 = 13, against
    // the scorer's target of 14 for that cohort. Flat H2s alone gave 7.
    const words = 1307;
    const h2 = h2FromWords(words);
    const perSection = Math.round(words / h2);
    const nested = 1 + h2 + h2 * subheadingsForSection(perSection);
    expect(1 + h2).toBe(7);
    expect(nested).toBeGreaterThanOrEqual(12);
    expect(nested).toBeLessThanOrEqual(16);
  });
});

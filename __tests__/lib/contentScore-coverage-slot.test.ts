import { collectScoreSlots, ScoreData } from '../../lib/contentScore';
import type { CoverageItem } from '../../lib/aiCoverage';

const entity = (label: string, covered: boolean): CoverageItem => ({
   id: `entity-${label}`,
   label,
   type: 'entity',
   category: 'knowledge',
   importance: 'recommended',
   source: 'serp',
   covered,
   quality: covered ? 5 : 0,
});

describe('collectScoreSlots — coverageItems dual-read (terms slot)', () => {
   it('prefers coverageItems entity rows over legacy scoreData.terms when present', () => {
      const html = '<h1>X</h1><p>hooks state effect</p>';
      const plainText = 'hooks state effect';
      const scoreData: ScoreData = {
         terms: [{ term: 'hooks', target_count: 5, current_count: 0 }], // would score low via legacy path
         words_target: 200,
         words_min: 100,
         words_max: 400,
         headings_target: 3,
         headings_min: 1,
         headings_max: 5,
      };

      // Both labels appear in plainText, so both are LIVE-covered regardless of the stale `covered` flag.
      const entityItems: CoverageItem[] = [entity('hooks', true), entity('state', false)];
      const withItems = collectScoreSlots(plainText, 200, 3, scoreData, 3, html, 'X', undefined, entityItems);
      const withoutItems = collectScoreSlots(plainText, 200, 3, scoreData, 3, html, 'X', undefined, undefined);

      const slot = (s: ReturnType<typeof collectScoreSlots>) => s.find((x) => x.key === 'terms');
      const withEarned = slot(withItems)?.earned ?? 0;
      const withoutEarned = slot(withoutItems)?.earned ?? 0;

      // 2/2 entity items live-covered (both labels appear in plainText) → 25; legacy path scores 0 (current_count 0 < target_count 5).
      expect(withEarned).toBe(25);
      expect(withEarned).toBeGreaterThan(withoutEarned);
      expect(slot(withItems)?.max).toBe(25);
      expect(slot(withItems)?.hint).toBe('2/2 terms covered');
   });

   it('scores the terms slot from the CURRENT text, not a stale snapshot `covered` flag (regression pin)', () => {
      const html = '<h1>X</h1><p>hooks are great</p>';
      const plainText = 'hooks are great';
      const scoreData: ScoreData = {
         terms: [],
         words_target: 200,
         words_min: 100,
         words_max: 400,
         headings_target: 3,
         headings_min: 1,
         headings_max: 5,
      };

      // Stale snapshot: "hooks" marked covered:true but has since been deleted from the text;
      // "state" marked covered:false but has since been typed into the text. A frozen-flag
      // read would score this as 1/2 (hooks); a live read must score it as 1/2 (state) instead —
      // same ratio, but driven by the opposite (current) term, proving the flag is not being read.
      const entityItems: CoverageItem[] = [entity('hooks', true), entity('state', false)];
      const plainTextWithState = 'state is managed carefully';
      const slots = collectScoreSlots(plainTextWithState, 200, 3, scoreData, 3, html, 'X', undefined, entityItems);
      const slot = slots.find((x) => x.key === 'terms');

      // "hooks" no longer appears (stale covered:true must NOT count); "state" now appears
      // (stale covered:false must NOT block it) → live coverage = 1/2 → round(0.5*25) = 13.
      expect(slot?.earned).toBe(13);
      expect(slot?.hint).toBe('1/2 terms covered');
   });

   it('falls back to legacy scoreData.terms when no coverageItems (zero regression)', () => {
      const html = '<h1>X</h1><p>hooks hooks hooks</p>';
      const plainText = 'hooks hooks hooks';
      const scoreData: ScoreData = {
         terms: [{ term: 'hooks', target_count: 2, current_count: 3 }],
         words_target: 200,
         words_min: 100,
         words_max: 400,
         headings_target: 3,
         headings_min: 1,
         headings_max: 5,
      };

      const noItems = collectScoreSlots(plainText, 200, 3, scoreData, 3, html, 'X', undefined, undefined);
      const omittedParam = collectScoreSlots(plainText, 200, 3, scoreData, 3, html, 'X', undefined);
      const emptyItems = collectScoreSlots(plainText, 200, 3, scoreData, 3, html, 'X', undefined, []);

      const slot = (s: ReturnType<typeof collectScoreSlots>) => s.find((x) => x.key === 'terms');

      expect(slot(noItems)?.earned).toBeGreaterThan(0);
      expect(slot(noItems)?.max).toBe(25);
      expect(slot(noItems)?.hint).toBe('Use the suggested terms at their target counts (see Keywords & Terms)');
      // Omitting the param entirely (legacy call sites) must produce the identical slot.
      expect(slot(omittedParam)).toEqual(slot(noItems));
      // An empty coverageItems array must behave identically to no coverageItems at all.
      expect(slot(emptyItems)).toEqual(slot(noItems));
   });
});

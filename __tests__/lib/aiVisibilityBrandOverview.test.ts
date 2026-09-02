/** @jest-environment node */
/**
 * The tracked brand's headline metric counts BRAND MENTIONS in the answers, which is what
 * the reference tool reports — not citations of our domain (that stays computeOverview).
 */
import { computeBrandOverview, ownBrandPosition } from '@/src/core/domain/aiVisibility/metrics';
import { presenceScore } from '@/src/core/domain/aiVisibility/presence';
import type { ResultRow } from '@/src/core/domain/aiVisibility/metricsTypes';

const row = (model: string, brands: string[], opts: { analyzed?: boolean } = {}): ResultRow => ({
   promptId: 1,
   model,
   // Deliberately "cited nowhere": proves the metric ignores citations entirely.
   ownCited: false,
   ownPosition: null,
   citations: [],
   topic: 'T',
   text: 'Q',
   brands: brands.map((brand, i) => ({ brand, domain: '', sentiment: 'neutral' as const, pos: i + 1, quotes: [] })),
   ...(opts.analyzed === false ? { brandsAnalyzed: false } : {}),
});

describe('ownBrandPosition', () => {
   it('matches on letters and digits only', () => {
      expect(ownBrandPosition(row('chat_gpt', ['Oracle', 'Pro Detektyw']), 'ProDetektyw')).toBe(2);
      expect(ownBrandPosition(row('chat_gpt', ['Oracle']), 'ProDetektyw')).toBeNull();
      expect(ownBrandPosition(row('chat_gpt', ['Oracle']), '')).toBeNull();
   });
});

describe('computeBrandOverview', () => {
   it('rates mentions over answers and averages the appearance position', () => {
      const o = computeBrandOverview([
         row('chat_gpt', ['Us', 'Oracle']),      // pos 1
         row('chat_gpt', ['Oracle', 'Us']),      // pos 2
         row('gemini', ['Oracle']),              // not named
         row('gemini', ['Oracle']),              // not named
      ], 'Us');
      expect(o.mentions).toBe(2);
      expect(o.pairs).toBe(4);
      expect(o.mentionRate).toBe(50);
      expect(o.avgPosition).toBe(1.5);
      expect(o.visibilityScore).toBe(presenceScore({ mentionRate: 50, avgPosition: 1.5 }));
      const byModel = Object.fromEntries(o.perModel.map((m) => [m.model, m.score]));
      expect(byModel.gemini).toBe(0);
      expect(byModel.chat_gpt).toBe(presenceScore({ mentionRate: 100, avgPosition: 1.5 }));
   });

   it('reports the rate to one decimal, like the reference tool', () => {
      const o = computeBrandOverview([row('chat_gpt', ['Us']), row('chat_gpt', ['X']), row('gemini', ['X'])], 'Us');
      expect(o.mentionRate).toBe(33.3);
   });

   it('leaves answers whose brands are not extracted yet out of the denominator', () => {
      const o = computeBrandOverview([
         row('chat_gpt', ['Us']),
         row('gemini', [], { analyzed: false }),
      ], 'Us');
      // 1 of 1 extracted answers, not 1 of 2 — the pending answer is unknown, not a miss.
      expect(o.pairs).toBe(1);
      expect(o.mentionRate).toBe(100);
   });

   it('never-mentioned brand and empty input score 0', () => {
      expect(computeBrandOverview([row('chat_gpt', ['Oracle'])], 'Us').visibilityScore).toBe(0);
      const empty = computeBrandOverview([], 'Us');
      expect(empty.visibilityScore).toBe(0);
      expect(empty.avgPosition).toBeNull();
      expect(empty.mentionRate).toBe(0);
   });
});

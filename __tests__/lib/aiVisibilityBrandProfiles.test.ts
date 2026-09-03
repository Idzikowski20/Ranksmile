/** @jest-environment node */
/**
 * Competitors are brand-keyed (reference-tool parity): one row per brand the answers name,
 * the tracked brand included, scored on the same triple as our own gauge.
 */
import { rankBrandProfiles } from '@/src/core/domain/aiVisibility/metrics';
import { presenceScore } from '@/src/core/domain/aiVisibility/presence';
import type { ResultRow } from '@/src/core/domain/aiVisibility/metricsTypes';

const row = (promptId: number, model: string, brands: Array<[string, string]>): ResultRow => ({
   promptId,
   model,
   ownCited: false,
   ownPosition: null,
   citations: [],
   topic: 't',
   text: 'q',
   brands: brands.map(([brand, domain], i) => ({
      brand, domain, sentiment: 'neutral' as const, pos: i + 1, quotes: [],
   })),
});

describe('rankBrandProfiles', () => {
   const rows: ResultRow[] = [
      row(1, 'chat_gpt', [['Alpha', 'alpha.pl'], ['Beta', 'beta.pl']]),
      row(1, 'gemini', [['Alpha', 'alpha.pl']]),
      row(2, 'chat_gpt', [['Beta', 'beta.pl']]),
      row(2, 'gemini', []),
   ];

   it('returns one row per brand, ranked by presence', () => {
      const out = rankBrandProfiles(rows);
      expect(out.map((b) => b.brand)).toEqual(['Alpha', 'Beta']);
   });

   it('scores mention rate over every pair and mean appearance position', () => {
      const [alpha, beta] = rankBrandProfiles(rows);
      // Alpha: named in 2 of 4 pairs, at position 1 both times.
      expect(alpha.mentions).toBe(2);
      expect(alpha.mentionRate).toBe(50);
      expect(alpha.avgPosition).toBe(1);
      expect(alpha.visibilityScore).toBe(presenceScore({ mentionRate: 50, avgPosition: 1 }));
      // Beta: 2 of 4 pairs, positions 2 and 1 → mean 1.5.
      expect(beta.mentionRate).toBe(50);
      expect(beta.avgPosition).toBe(1.5);
   });

   it('keeps the first domain it sees for a brand', () => {
      expect(rankBrandProfiles(rows)[0].domain).toBe('alpha.pl');
   });

   it('handles a scan with no brands', () => {
      expect(rankBrandProfiles([row(1, 'chat_gpt', [])])).toEqual([]);
      expect(rankBrandProfiles([])).toEqual([]);
   });
});

describe('rankBrandProfiles agrees with the own-brand metric', () => {
   const two = (brands: Array<[string, string]>): ResultRow => row(1, 'chat_gpt', brands);

   it('counts one mention per answer, at its first position', () => {
      // The extractor can list the same brand twice in one answer; the rate is a share of
      // ANSWERS, so that must not count twice — computeBrandOverview counts it once.
      const [b] = rankBrandProfiles([two([['Alpha', 'a.pl'], ['Alpha', 'a.pl']])]);
      expect(b.mentions).toBe(1);
      expect(b.mentionRate).toBe(100);
      expect(b.avgPosition).toBe(1);
   });

   it('groups spacing and punctuation variants as one brand, like brandKey', () => {
      const out = rankBrandProfiles([
         row(1, 'chat_gpt', [['Pro Detektyw', 'pd.pl']]),
         row(2, 'chat_gpt', [['ProDetektyw', '']]),
      ]);
      expect(out).toHaveLength(1);
      expect(out[0].mentions).toBe(2);
   });
});

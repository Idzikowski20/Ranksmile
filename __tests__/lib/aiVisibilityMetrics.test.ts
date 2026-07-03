import { ownDomainPosition, computeOverview, aggregateSources, aggregateCompetitors, ResultRow } from '../../lib/aiVisibilityMetrics';

const cit = (domain: string, url?: string) => ({ domain, url: url || `https://${domain}/x`, title: '' });

const rows: ResultRow[] = [
   { promptId: 1, model: 'chat_gpt', ownCited: true, ownPosition: 1, citations: [cit('idztech.pl', 'https://idztech.pl/a'), cit('oracle.com')] },
   { promptId: 1, model: 'gemini', ownCited: false, ownPosition: null, citations: [cit('oracle.com')] },
   { promptId: 2, model: 'chat_gpt', ownCited: true, ownPosition: 3, citations: [cit('shoper.pl'), cit('oracle.com'), cit('idztech.pl', 'https://idztech.pl/b')] },
   { promptId: 2, model: 'gemini', ownCited: false, ownPosition: null, citations: [] },
];

describe('ownDomainPosition', () => {
   it('returns 1-based index of first own citation, www-insensitive', () => {
      expect(ownDomainPosition([cit('a.com'), cit('www.idztech.pl')], 'idztech.pl')).toBe(2);
      expect(ownDomainPosition([cit('a.com')], 'idztech.pl')).toBeNull();
      expect(ownDomainPosition([cit('a.com')], '')).toBeNull();
   });
});

describe('computeOverview', () => {
   it('computes score, rate, position, citations, pages', () => {
      const o = computeOverview(rows);
      // scores: 100 (p1) + 0 + 70 (p3) + 0 = 170/4 = 42.5 → 43
      expect(o.visibilityScore).toBe(43);
      expect(o.mentionRate).toBe(50);
      expect(o.avgPosition).toBe(2);
      expect(o.directCitations).toBe(2);
      expect(o.pages).toBe(2);
      const byModel = Object.fromEntries(o.perModel.map((m) => [m.model, m.score]));
      expect(byModel).toEqual({ chat_gpt: 85, gemini: 0 });
   });
   it('handles empty input', () => {
      const o = computeOverview([]);
      expect(o.visibilityScore).toBe(0);
      expect(o.avgPosition).toBeNull();
      expect(o.mentionRate).toBe(0);
   });
});

describe('aggregateSources', () => {
   it('counts url occurrences across models, sorted desc', () => {
      const s = aggregateSources(rows);
      const oracle = s.find((x) => x.domain === 'oracle.com');
      expect(oracle?.timesShown).toBe(3);
      expect(oracle?.models.sort()).toEqual(['chat_gpt', 'gemini']);
      expect(s[0].timesShown).toBeGreaterThanOrEqual(s[s.length - 1].timesShown);
   });
});

describe('aggregateCompetitors', () => {
   it('excludes own domain and computes share of total citations', () => {
      const c = aggregateCompetitors(rows, 'idztech.pl');
      expect(c.find((x) => x.domain === 'idztech.pl')).toBeUndefined();
      expect(c[0].domain).toBe('oracle.com');
      expect(c[0].mentions).toBe(3);
   });
});

// Local mock of the DB module — importing lib/articleTerms.ts (which now also
// exports readArticleTerms) transitively pulls in sequelize (ESM uuid dep) and
// crashes Jest. Not needed here: these tests only exercise the pure adapter.
// Kept local (not a root __mocks__/ auto-mock) so it can't affect unrelated suites.
jest.mock('../../database/database', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

import { articleTermsToCoverageItems, ArticleTermRow } from '../../lib/articleTerms';

const row = (over: Partial<ArticleTermRow> = {}): ArticleTermRow => ({
  term: 't', term_type: 'topic', source: 'serp',
  importance: 0.5, target_min: 2, target_max: 4, current_count: 0, ...over,
});

describe('articleTermsToCoverageItems', () => {
  it('topic/entity → type:entity, category:knowledge, importance thresholded', () => {
    const items = articleTermsToCoverageItems([
      row({ term: 'crit', importance: 0.9 }),
      row({ term: 'rec', importance: 0.5 }),
      row({ term: 'opt', importance: 0.1 }),
    ]);
    expect(items.map((i) => i.importance)).toEqual(['critical', 'recommended', 'optional']);
    expect(items.every((i) => i.type === 'entity' && i.category === 'knowledge')).toBe(true);
  });
  it('normalizes raw target_count importance relative to the batch max (not all critical)', () => {
    // article_terms.importance is a raw integer count (>=1), not 0..1 — a batch of 12/6/1
    // must NOT all bucket to 'critical'. Ratios vs max(12): 1.0, 0.5, 0.083.
    const items = articleTermsToCoverageItems([
      row({ term: 'top', importance: 12 }),
      row({ term: 'mid', importance: 6 }),
      row({ term: 'low', importance: 1 }),
    ]);
    expect(items.map((i) => i.importance)).toEqual(['critical', 'recommended', 'optional']);
  });
  it('all-zero importance batch → everything optional (no divide-by-zero)', () => {
    const items = articleTermsToCoverageItems([
      row({ term: 'a', importance: 0 }),
      row({ term: 'b', importance: 0 }),
    ]);
    expect(items.map((i) => i.importance)).toEqual(['optional', 'optional']);
  });
  it('term_type:question → type:fact (still category:knowledge)', () => {
    const [item] = articleTermsToCoverageItems([row({ term: 'q', term_type: 'question' })]);
    expect(item.type).toBe('fact');
    expect(item.category).toBe('knowledge');
  });
  it('covered + quality from current_count vs target', () => {
    const [under] = articleTermsToCoverageItems([row({ current_count: 0 })]);
    expect(under.covered).toBe(false);
    expect(under.quality).toBe(0);
    const [met] = articleTermsToCoverageItems([row({ current_count: 3 })]);
    expect(met.covered).toBe(true);
    expect(met.quality).toBe(5);
    const [partial] = articleTermsToCoverageItems([row({ current_count: 1 })]);
    expect(partial.covered).toBe(false);
    expect(partial.quality).toBeGreaterThan(0);
    expect(partial.quality).toBeLessThan(5);
  });
  it('stable hashed ids regardless of order', () => {
    const a = articleTermsToCoverageItems([row({ term: 'hooks' }), row({ term: 'state' })]);
    const b = articleTermsToCoverageItems([row({ term: 'state' }), row({ term: 'hooks' })]);
    expect(a.map((i) => i.id).sort()).toEqual(b.map((i) => i.id).sort());
  });
});

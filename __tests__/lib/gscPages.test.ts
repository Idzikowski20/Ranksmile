import { aggregateGscPages } from '../../utils/gsc';

describe('aggregateGscPages', () => {
  it('sums metrics per page, keeps the best query and honours exclude', () => {
    const rows = [
      { page: 'https://x.pl/a/', keyword: 'weak', clicks: 1, impressions: 5 },
      { page: 'https://x.pl/a', keyword: 'strong', clicks: 4, impressions: 2 },
      { page: 'https://x.pl/b', keyword: 'b', clicks: 3, impressions: 9 },
      { keyword: 'no page', clicks: 9, impressions: 9 },
    ];

    const pages = aggregateGscPages(rows, new Set(['/b']));

    expect(pages).toEqual([
      { path: '/a', url: 'https://x.pl/a', keyword: 'strong', clicks: 5, impressions: 7 },
    ]);
  });
});

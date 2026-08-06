import {
  competitorsFromScoreData,
  parseCompetitorCacheJson,
} from '../../../lib/contentPlanner/fromArticleInputs';

describe('parseCompetitorCacheJson', () => {
  const cache = JSON.stringify({
    competitors: [
      {
        url: 'https://a.pl/x',
        title: 'A',
        word_count: 2100,
        heading_count: 21,
        headings: [
          { level: 1, text: 'Tytuł' },
          { level: 2, text: 'Czym jest szantaż' },
          { level: 2, text: 'Jak reagować' },
        ],
      },
    ],
  });

  it('keeps the competitor heading count from the outlines cache', () => {
    const [competitor] = parseCompetitorCacheJson(cache);
    expect(competitor.headings).toBe(21);
    expect(competitor.wordCount).toBe(2100);
  });

  it('falls back to counting object headings when heading_count is missing', () => {
    const raw = JSON.stringify({
      competitors: [{
        url: 'https://a.pl/x',
        headings: [{ level: 2, text: 'Jak reagować' }, { level: 3, text: 'Krok 1' }],
      }],
    });
    expect(parseCompetitorCacheJson(raw)[0].headings).toBe(2);
  });

  it('ignores blank heading entries', () => {
    const raw = JSON.stringify({
      competitors: [{ url: 'https://a.pl/x', headings: [{ level: 2, text: '  ' }, '', 'Realny'] }],
    });
    expect(parseCompetitorCacheJson(raw)[0].headings).toBe(1);
  });
});

describe('competitorsFromScoreData', () => {
  it('still accepts a plain heading count', () => {
    const rows = competitorsFromScoreData({ competitors: [{ url: 'https://a.pl', headings: 17 }] });
    expect(rows[0].headings).toBe(17);
  });

  it('prefers an explicit h2_count over the cached total', () => {
    const rows = competitorsFromScoreData({
      competitors: [{ url: 'https://a.pl', h2_count: 9, heading_count: 30, headings: [{ level: 2, text: 'x' }] }],
    });
    expect(rows[0].headings).toBe(9);
  });
});

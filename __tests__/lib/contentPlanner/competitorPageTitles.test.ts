import { competitorPageTitles } from '@/src/infrastructure/contentPlanner/fromArticleInputs';

describe('competitorPageTitles', () => {
  it('prefers the SERP title, falls back to the page title, dedupes and caps', () => {
    const raw = JSON.stringify({
      competitors: [
        { url: 'a', serp_title: 'Najemca nie płaci czynszu – co zrobić?', title: 'H1 A' },
        { url: 'b', title: 'Lokator nie płaci: krok po kroku' },
        { url: 'c', serp_title: 'najemca nie płaci czynszu – co zrobić?' },
        { url: 'd', title: 'short' },
        'garbage',
      ],
    });

    expect(competitorPageTitles(raw)).toEqual([
      'Najemca nie płaci czynszu – co zrobić?',
      'Lokator nie płaci: krok po kroku',
    ]);
  });

  it('returns nothing for a missing or malformed cache', () => {
    expect(competitorPageTitles(null)).toEqual([]);
    expect(competitorPageTitles('not json')).toEqual([]);
  });
});

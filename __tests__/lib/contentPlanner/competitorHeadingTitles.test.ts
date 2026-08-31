import { competitorHeadingTitles } from '@/src/infrastructure/contentPlanner/fromArticleInputs';

function cache(headings: string[]): string {
  return JSON.stringify({
    competitors: [{ url: 'https://pl.wikipedia.org/x', headings: headings.map((text) => ({ level: 2, text })) }],
  });
}

describe('competitorHeadingTitles — encyclopedia furniture', () => {
  it('drops Wikipedia section furniture but keeps topical headings', () => {
    const out = competitorHeadingTitles(cache([
      'Techniki szantażu emocjonalnego',
      'Przypisy',
      'Mechanizmy emocjonalne wykorzystywane w szantażu',
      'Bibliografia',
      'Zobacz też',
      'Linki zewnętrzne',
      'Wpływ szantażu emocjonalnego na ofiary',
    ]));
    expect(out).toContain('Techniki szantażu emocjonalnego');
    expect(out).toContain('Mechanizmy emocjonalne wykorzystywane w szantażu');
    expect(out).toContain('Wpływ szantażu emocjonalnego na ofiary');
    expect(out.some((h) => /przypisy|bibliografia|zobacz też|linki zewnętrzne/i.test(h))).toBe(false);
  });
});

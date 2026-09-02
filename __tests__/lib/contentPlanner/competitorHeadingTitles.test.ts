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

describe('competitorHeadingTitles — service-page chrome', () => {
  it('drops nav/footer/CTA headings a service SERP carries, keeps topical ones', () => {
    // The exact headings that leaked into article 160's outline from the
    // "prywatny detektyw warszawa" SERP — nav, footer, contact and CTA blocks that sit
    // in <section>/<div> containers the nav/footer strip never reached.
    const out = competitorHeadingTitles(cache([
      'Zakres usług detektywistycznych w Warszawie',
      'Godziny otwarcia',
      'Najnowsze wpisy',
      'Zapraszamy do naszych biur',
      'Porozmawiaj ze specjalistą. Działamy na terenie całej Polski',
      'Kontakt z nami',
      'O naszej firmie',
      'Jak wykrywanie podsłuchów chroni ofiary szantażu',
      'Kontakt z dzieckiem po rozwodzie',
    ]));
    expect(out).toContain('Zakres usług detektywistycznych w Warszawie');
    expect(out).toContain('Jak wykrywanie podsłuchów chroni ofiary szantażu');
    // Topical heading that merely starts with "Kontakt" must survive (not chrome).
    expect(out).toContain('Kontakt z dzieckiem po rozwodzie');
    for (const chrome of ['Godziny otwarcia', 'Najnowsze wpisy', 'Zapraszamy do naszych biur', 'Porozmawiaj ze specjalistą. Działamy na terenie całej Polski', 'Kontakt z nami', 'O naszej firmie']) {
      expect(out).not.toContain(chrome);
    }
  });
});

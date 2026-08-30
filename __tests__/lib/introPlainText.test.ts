import { introPlainTextFromHtml } from '@/src/infrastructure/coverage/buildCoverageSnapshot';

describe('introPlainTextFromHtml', () => {
  it('falls back to the body when the pre-H2 section is only the title', () => {
    // Exactly what the writer emits: H1, then straight into the first H2 section.
    const html = '<h1>Szantaz emocjonalny — poufna pomoc detektywow</h1>'
      + '<h2>Najwazniejsze odpowiedzi</h2>'
      + '<p>Szantaz emocjonalny to forma manipulacyjnej presji.</p>';
    const body = 'Szantaz emocjonalny to forma manipulacyjnej presji, ktora odwoluje sie do emocji '
      + 'zamiast do rzeczowej rozmowy i argumentow, a osoba wywierajaca presje przenosi na Ciebie '
      + 'odpowiedzialnosc za wlasne emocje, decyzje lub cierpienie i oczekuje uleglosci.';

    const intro = introPlainTextFromHtml(html, body);

    expect(intro).toBe(body);
    expect(intro).not.toBe('Szantaz emocjonalny — poufna pomoc detektywow');
  });

  it('keeps a real intro section', () => {
    const lead = 'A'.repeat(250);
    const html = `<h1>Title</h1><p>${lead}</p><h2>Next</h2><p>more</p>`;

    expect(introPlainTextFromHtml(html, 'fallback')).toContain(lead);
  });
});

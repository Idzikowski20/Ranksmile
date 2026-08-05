import { scoreEeat, EEAT_SOFT_FLOOR } from '../../../lib/wie/eeatScore';
import { wieJudgeHtml, wieWriterSystemPrompt } from '../../../lib/wie/writer';

describe('WIE EEAT score', () => {
  it('scores expert practical text higher than stub', () => {
    const strong = scoreEeat(
      'W praktyce najczęściej nie płać. Na przykład Messenger. Skonsultuj sprawę z policją — ryzyko może się różnić.',
    );
    const weak = scoreEeat('Definicja. To jest tekst. Koniec.');
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.experience).toBeGreaterThan(40);
    expect(strong.reasons).toContain('experience_markers');
  });

  it('penalizes fake credentials', () => {
    const r = scoreEeat('Jesteśmy certyfikowany ekspert SEO z 20-letnim doświadczeniem i gwarantujemy pozycję #1.');
    expect(r.reasons).toContain('fake_credentials_penalty');
    expect(r.trustworthiness).toBeLessThan(40);
  });
});

describe('WIE shared Writer judge', () => {
  it('exposes system preamble', () => {
    expect(wieWriterSystemPrompt()).toMatch(/Writing Intelligence Writer/);
  });

  it('rejects fake credentials via unified judge', () => {
    const j = wieJudgeHtml({
      html: '<p>Gwarantujemy pozycję #1 jako certyfikowany ekspert SEO z 20-letnim doświadczeniem. '
        + `${'słowo '.repeat(80)}</p>`,
      action: 'rewrite_section',
      requireEeat: true,
    });
    expect(j.ok).toBe(false);
    expect(j.reasons.some((r) => r.includes('fake') || r.includes('rx:'))).toBe(true);
  });

  it('accepts solid expert section above EEAT floor', () => {
    const paras = Array.from({ length: 5 }, (_, i) =>
      `<p>${'treść '.repeat(30)} ${i === 1 ? 'W praktyce nie płać. Na przykład Messenger.' : ''} `
      + `${i === 2 ? 'Skonsultuj sprawę — ryzyko może się różnić.' : ''}</p>`,
    ).join('');
    const j = wieJudgeHtml({
      html: `<h2>Co robić</h2>${paras}`,
      action: 'rewrite_section',
      requireEeat: true,
    });
    expect(j.eeat.score).toBeGreaterThanOrEqual(EEAT_SOFT_FLOOR);
    expect(j.ok).toBe(true);
  });
});

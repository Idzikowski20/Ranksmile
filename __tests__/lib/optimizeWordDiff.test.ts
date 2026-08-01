import { wordDiffSegments, renderDiffHtml, renderStructuredDiffHtml } from '../../lib/optimizeWordDiff';

describe('wordDiffSegments', () => {
  it('marks removed + added words between two strings', () => {
    const segs = wordDiffSegments('Tworzymy aplikacje', 'Tworzenie aplikacji');
    expect(segs.filter((s) => s.type === 'removed').map((s) => s.text).join('')).toContain('Tworzymy');
    expect(segs.filter((s) => s.type === 'added').map((s) => s.text).join('')).toContain('Tworzenie');
    expect(segs.some((s) => s.type === 'equal' && /aplikacj/.test(s.text))).toBe(true);
  });
  it('returns a single equal segment when texts match', () => {
    expect(wordDiffSegments('same text', 'same text')).toEqual([{ type: 'equal', text: 'same text' }]);
  });
});

describe('renderStructuredDiffHtml', () => {
  it('preserves H2/H3/P block structure instead of one flat wall', () => {
    const before = '<h2>Czym jest</h2><p>Stara definicja.</p>';
    const after =
      '<h2>Czym jest</h2><p>Nowa definicja cuckoldingu.</p>'
      + '<h2>Najczęściej zadawane pytania</h2>'
      + '<h3>Czym różni się od zdrady?</h3>'
      + '<p>Odpowiedź oparta na zgodzie partnerów w związku.</p>';
    const html = renderStructuredDiffHtml(before, after);
    expect(html).toMatch(/<h2[\s>]/i);
    expect(html).toMatch(/<h3[\s>]/i);
    expect(html).toMatch(/<p[\s>]/i);
    expect(html).toContain('data-diff-type="added"');
    // Must not collapse into a single unbroken text node without block tags
    expect((html.match(/<\/(?:h2|h3|p)>/gi) || []).length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to flat word diff when HTML has no block tags', () => {
    const html = renderStructuredDiffHtml('stary tekst', 'nowy tekst');
    expect(html).toContain('data-diff-type');
  });
});

describe('renderDiffHtml', () => {
  it('wraps added/removed spans', () => {
    const html = renderDiffHtml([
      { type: 'equal', text: 'a ' },
      { type: 'removed', text: 'old' },
      { type: 'added', text: 'new' },
    ]);
    expect(html).toContain('data-diff-type="removed"');
    expect(html).toContain('data-diff-type="added"');
  });
});

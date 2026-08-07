import { sanitizeArticleHtml } from '../../lib/sanitizeHtml';

describe('sanitizeArticleHtml active schemes', () => {
  it.each([
    ['javascript', '<a href="javascript:alert(1)">x</a>'],
    ['vbscript', '<a href="vbscript:msgbox(1)">x</a>'],
    ['padded javascript', '<a href="  java	script:alert(1)">x</a>'],
    ['data:text/html', '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>'],
  ])('drops a %s href', (_label, html) => {
    expect(sanitizeArticleHtml(html)).not.toMatch(/href=/i);
  });

  it('keeps ordinary links and inline images', () => {
    const out = sanitizeArticleHtml('<a href="https://gov.pl/x">y</a><img src="data:image/png;base64,AA">');
    expect(out).toContain('href="https://gov.pl/x"');
    expect(out).toContain('src="data:image/png;base64,AA"');
  });
});

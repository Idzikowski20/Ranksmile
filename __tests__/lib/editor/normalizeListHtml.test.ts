/**
 * @jest-environment jsdom
 */
import { normalizeListHtml } from '../../../lib/editor/normalizeListHtml';

describe('normalizeListHtml', () => {
  it('pulls orphan trailing paragraphs back into the preceding ul', () => {
    const html =
      '<ul><li><p>a;</p></li><li><p>b;</p></li></ul><p>c.</p><p>Next section.</p>';
    expect(normalizeListHtml(html)).toBe(
      '<ul><li><p>a;</p></li><li><p>b;</p></li><li><p>c.</p></li></ul><p>Next section.</p>',
    );
  });

  it('handles ol the same way', () => {
    const html = '<ol><li><p>one;</p></li></ol><p>two;</p>';
    expect(normalizeListHtml(html)).toBe(
      '<ol><li><p>one;</p></li><li><p>two;</p></li></ol>',
    );
  });

  it('no-ops when the following paragraph looks like a real paragraph', () => {
    const html =
      '<ul><li><p>item;</p></li></ul><p>Sprawca często próbuje odizolować ofiarę i zmusić ją do szybkiego działania.</p>';
    expect(normalizeListHtml(html)).toBe(html);
  });

  it('returns empty/unchanged input safely', () => {
    expect(normalizeListHtml('')).toBe('');
    expect(normalizeListHtml('<p>hi</p>')).toBe('<p>hi</p>');
  });
});

import { sanitizeArticleHtml } from '../../lib/sanitizeHtml';

describe('sanitizeArticleHtml', () => {
  it('removes <script> tags', () => {
    const out = sanitizeArticleHtml('<p>hi</p><script>alert(1)</script>');
    expect(out).not.toMatch(/script/i);
    expect(out).toContain('<p>hi</p>');
  });

  it('removes <iframe>, <object>, <embed>', () => {
    const out = sanitizeArticleHtml('<iframe src="x"></iframe><object></object><embed>');
    expect(out).not.toMatch(/iframe|object|embed/i);
  });

  it('strips on* event handlers (the onerror XSS vector)', () => {
    const out = sanitizeArticleHtml('<img src="x" onerror="fetch(1)">');
    expect(out).not.toMatch(/onerror/i);
    expect(out).toContain('<img');
  });

  it('strips javascript: and data:text/html in href/src', () => {
    const out = sanitizeArticleHtml('<a href="javascript:alert(1)">x</a><img src="data:text/html,<script>">');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/data:text\/html/i);
  });

  it('keeps normal prose, links, and inline data-image sources', () => {
    const html = '<h2>Title</h2><p>Body <a href="https://ok.com">link</a></p><img src="data:image/png;base64,AAAA">';
    const out = sanitizeArticleHtml(html);
    expect(out).toContain('<h2>Title</h2>');
    expect(out).toContain('href="https://ok.com"');
    expect(out).toContain('data:image/png;base64,AAAA');
  });

  it('returns empty string for falsy input', () => {
    expect(sanitizeArticleHtml('')).toBe('');
  });
});

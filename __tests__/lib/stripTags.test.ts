import { stripTags, escapeHtml } from '@/src/core/shared/html';

describe('stripTags', () => {
  it('drops tags and collapses whitespace', () => {
    expect(stripTags('<p>Hello   <b>world</b></p>')).toBe('Hello world');
  });

  it('drops script and style bodies instead of leaking them as prose', () => {
    expect(stripTags('<p>Keep</p><script>var leak = 1;</script>')).toBe('Keep');
    expect(stripTags('<style>.a{color:red}</style><p>Keep</p>')).toBe('Keep');
  });

  it('tolerates empty input', () => {
    expect(stripTags('')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes all five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`))
      .toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;');
  });

  it('tolerates empty input', () => {
    expect(escapeHtml('')).toBe('');
  });
});

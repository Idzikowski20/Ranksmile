import { cleanHtmlForWordPress } from '../../lib/wpContentClean';

const clean = (s: string) => cleanHtmlForWordPress(s);

describe('cleanHtmlForWordPress — Gutenberg-supported tags survive', () => {
  it('keeps tables (and their cells), stripping only cruft attrs', () => {
    const out = clean('<table class="x" data-foo="1"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>');
    expect(out).toContain('<table>');
    expect(out).toContain('<th>A</th>');
    expect(out).toContain('<td>1</td>');
    expect(out).not.toContain('data-foo');
  });

  it('keeps blockquotes', () => {
    const out = clean('<blockquote><p>quoted</p></blockquote>');
    expect(out).toContain('<blockquote>');
    expect(out).toContain('quoted');
  });

  it('keeps pre/code blocks', () => {
    const out = clean('<pre><code>const x = 1;</code></pre>');
    expect(out).toContain('<pre>');
    expect(out).toContain('const x = 1;');
  });

  it('keeps nested lists', () => {
    const out = clean('<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul>');
    expect(out).toContain('nested');
    expect((out.match(/<ul>/g) || []).length).toBe(2);
  });

  it('reduces a <figure> with an image to just the <img>, dropping the caption', () => {
    const out = clean('<figure><img src="/a.png" alt="A"><figcaption>cap</figcaption></figure>');
    expect(out).toContain('<img');
    expect(out).toContain('src="/a.png"');
    expect(out).not.toContain('figcaption');
    expect(out).not.toContain('cap');
  });

  it('preserves non-image content wrapped in a <figure> (e.g. a table) instead of dropping it', () => {
    const out = clean('<figure class="wp-block-table"><table><tbody><tr><td>cell</td></tr></tbody></table></figure>');
    expect(out).toContain('<table>');
    expect(out).toContain('cell');
  });

  it('lifts an <img> out of a paragraph so it becomes a standalone image', () => {
    const out = clean('<p>text <img src="/b.png" alt="B"></p>');
    expect(out).toContain('src="/b.png"');
    // the img must not remain inside the <p>
    expect(out).not.toMatch(/<p>[^<]*<img/);
  });

  it('unwraps structural wrappers and strips disallowed attributes', () => {
    const out = clean('<div class="wrap"><section><p style="color:red" data-x="1">hi</p></section></div>');
    expect(out).not.toContain('<div');
    expect(out).not.toContain('<section');
    expect(out).not.toContain('style=');
    expect(out).not.toContain('data-x');
    expect(out).toContain('<p>hi</p>');
  });
});

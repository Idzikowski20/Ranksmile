/**
 * Article cards (dashboard + Content) show one badge and one thumbnail per article.
 * The badge answers "what happens when I click": Waiting review = the outline is planned
 * and the article waits for Generate content; Being edited = written, not live;
 * Published = live on WordPress; Generating = the pipeline still owns it.
 */
import { articleCardStatus, articlePreviewHtml } from '@/src/core/domain/articles/articleCard';

describe('articleCardStatus', () => {
  it('is published once the article is live, whatever the row status says', () => {
    expect(articleCardStatus({ status: 'published', publish_url: null, is_outline: false, has_content: true })).toBe('published');
    expect(articleCardStatus({ status: 'draft', publish_url: 'https://x.pl/a', is_outline: false, has_content: true })).toBe('published');
  });

  it('is generating while the pipeline owns the row', () => {
    for (const status of ['generating', 'analyzing', 'queued', 'running', 'finalizing']) {
      expect(articleCardStatus({ status, publish_url: null, is_outline: false, has_content: false })).toBe('generating');
    }
  });

  it('waits for review when only the outline exists', () => {
    expect(articleCardStatus({ status: 'draft', publish_url: null, is_outline: true, has_content: true })).toBe('waiting_review');
    expect(articleCardStatus({ status: 'draft', publish_url: null, is_outline: false, has_content: false })).toBe('waiting_review');
  });

  it('is being edited when the article is written but not live', () => {
    expect(articleCardStatus({ status: 'draft', publish_url: null, is_outline: false, has_content: true })).toBe('being_edited');
    expect(articleCardStatus({ status: 'accepted', publish_url: null, is_outline: false, has_content: true })).toBe('being_edited');
  });
});

describe('articlePreviewHtml', () => {
  const para = (n: number) => `<p>${'słowo '.repeat(n).trim()}</p>`;

  it('keeps a short article whole', () => {
    const html = `<h1>Tytuł</h1>${para(20)}`;
    expect(articlePreviewHtml(html, 3000)).toBe(html);
  });

  it('cuts on a block boundary, never inside a tag or a block', () => {
    const html = `<h1>Tytuł</h1>${para(200)}<h2>Sekcja</h2>${para(200)}${para(200)}`;
    const out = articlePreviewHtml(html, 1500);
    expect(out.length).toBeLessThanOrEqual(1500);
    expect(out.endsWith('</p>') || out.endsWith('</h2>') || out.endsWith('</h1>')).toBe(true);
    expect(out.startsWith('<h1>Tytuł</h1>')).toBe(true);
  });

  it('still returns the first block when it alone exceeds the budget', () => {
    const html = para(2000);
    const out = articlePreviewHtml(html, 500);
    expect(out).toBe(html);
  });

  it('drops scripts, frames and inline handlers — the thumbnail is inert', () => {
    const html = '<p onclick="x()">a</p><script>alert(1)</script><iframe src="x"></iframe><p>b</p>';
    const out = articlePreviewHtml(html, 3000);
    expect(out).toBe('<p>a</p><p>b</p>');
  });

  it('returns an empty string for no content', () => {
    expect(articlePreviewHtml(null, 3000)).toBe('');
    expect(articlePreviewHtml('   ', 3000)).toBe('');
  });
});

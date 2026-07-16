import { structureIssues } from '../../lib/validateArticleStructure';

describe('validateArticleStructure', () => {
  it('flags paragraphs over 700 chars', () => {
    const long = 'x'.repeat(750);
    const issues = structureIssues(`<p>${long}</p>`);
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain('750 chars');
  });

  it('passes readable human paragraphs', () => {
    const body = 'x'.repeat(280);
    expect(structureIssues(`<p>${body}</p><p>${body}</p>`)).toHaveLength(0);
  });

  it('flags thin heading spam', () => {
    const html = '<h2>Thin section</h2><p>Only fifty characters of body text here!!</p><h2>Next</h2><p>Also thin stub under heading here.</p>';
    const issues = structureIssues(html);
    expect(issues.some((i) => i.includes('only') && i.includes('chars of body'))).toBe(true);
  });
});

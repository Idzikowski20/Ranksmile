import { structureIssues } from '../../lib/validateArticleStructure';

describe('validateArticleStructure', () => {
  it('flags paragraphs over 250 chars', () => {
    const long = 'x'.repeat(300);
    const issues = structureIssues(`<p>${long}</p>`);
    expect(issues.length).toBe(1);
    expect(issues[0]).toContain('300 chars');
  });

  it('passes short paragraphs', () => {
    expect(structureIssues('<p>Short paragraph under limit.</p>')).toHaveLength(0);
  });
});

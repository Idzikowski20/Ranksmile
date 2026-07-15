import { buildWholeArticlePrompt } from '../../lib/optimizeWholeArticle';

describe('optimizeWholeArticle prompt v2', () => {
  it('includes structure rules with 100-200 chars', () => {
    const { systemPrompt } = buildWholeArticlePrompt({
      ctx: null,
      html: '<p>test</p>',
      guidelines: [],
      seoScore: 50,
      aiScore: 30,
      phase: 'first_run',
    });
    expect(systemPrompt).toContain('100–200 characters');
    expect(systemPrompt).toContain('<ul>');
    expect(systemPrompt).toContain('<table>');
    expect(systemPrompt).not.toContain('40 and ~80 words');
    expect(systemPrompt).toContain('NEVER prepend keyword phrases');
  });
});

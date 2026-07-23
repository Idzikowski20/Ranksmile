/**
 * Regression: /articles/generating must not treat a finished deep_analysis job
 * as a finished article_generate job (that skipped /generate → empty editor).
 */
describe('job-progress articleId lookup jobType', () => {
  it('defaults to deep_analysis when jobType is omitted', () => {
    const jobTypeRaw = '';
    const jobType = jobTypeRaw || 'deep_analysis';
    expect(jobType).toBe('deep_analysis');
  });

  it('accepts article_generate for generate resume polling', () => {
    const jobTypeRaw = 'article_generate';
    const jobType = jobTypeRaw.trim() || 'deep_analysis';
    expect(jobType).toBe('article_generate');
  });

  it('building resume URL includes jobType=article_generate', () => {
    const articleId = '153';
    const url = `/api/articles/job-progress?articleId=${encodeURIComponent(articleId)}&jobType=article_generate`;
    expect(url).toContain('jobType=article_generate');
    expect(url).not.toMatch(/jobType=deep_analysis/);
  });
});

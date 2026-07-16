import {
  isStaleDeepAnalysisJob,
  resolveAnalyzingStatusOnLoad,
} from '../../lib/deepAnalysisProgress';

describe('resolveAnalyzingStatusOnLoad', () => {
  it('keeps analyzing when no job exists yet (fresh import race)', () => {
    // Import sets status=analyzing before the editor starts deep-analysis.
    // Treating 404 as draft prevented the sidebar pipeline from ever running.
    expect(resolveAnalyzingStatusOnLoad(null)).toBe('analyzing');
  });

  it('unlocks after terminal jobs', () => {
    expect(resolveAnalyzingStatusOnLoad({ status: 'done' })).toBe('draft');
    expect(resolveAnalyzingStatusOnLoad({ status: 'failed', progressMessage: 'boom' })).toBe('draft');
  });

  it('keeps analyzing for a live running job', () => {
    expect(resolveAnalyzingStatusOnLoad({
      status: 'running',
      currentStage: 'serp_crawl',
      progressMessage: 'Crawling…',
      updatedAt: new Date().toISOString(),
    })).toBe('analyzing');
  });

  it('unlocks stale running jobs', () => {
    const stale = {
      status: 'running' as const,
      currentStage: 'serp_crawl',
      progressMessage: 'Crawling…',
      updatedAt: new Date(Date.now() - 120_000).toISOString(),
    };
    expect(isStaleDeepAnalysisJob(stale)).toBe(true);
    expect(resolveAnalyzingStatusOnLoad(stale)).toBe('draft');
  });
});

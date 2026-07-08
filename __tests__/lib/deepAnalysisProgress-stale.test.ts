import { isStaleDeepAnalysisJob } from '../../lib/deepAnalysisProgress';

describe('isStaleDeepAnalysisJob', () => {
  it('treats claimed-but-never-started jobs as stale after 3 minutes', () => {
    const updatedAt = new Date(Date.now() - 181_000).toISOString();
    expect(isStaleDeepAnalysisJob({
      status: 'running',
      currentStage: 'fetch_page',
      progressMessage: 'Starting analysis...',
      updatedAt,
    })).toBe(true);
  });

  it('keeps a fresh claimed job active', () => {
    const updatedAt = new Date(Date.now() - 5_000).toISOString();
    expect(isStaleDeepAnalysisJob({
      status: 'running',
      currentStage: 'fetch_page',
      progressMessage: 'Starting analysis...',
      updatedAt,
    })).toBe(false);
  });

  it('does not treat missing updatedAt as immediately stale', () => {
    expect(isStaleDeepAnalysisJob({
      status: 'running',
      currentStage: 'fetch_page',
      progressMessage: 'Starting analysis...',
      updatedAt: null,
    })).toBe(false);
  });
});

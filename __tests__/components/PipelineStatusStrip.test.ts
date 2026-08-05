import { dedupeActiveJobs } from '../../components/articles/PipelineStatusStrip';

describe('dedupeActiveJobs', () => {
  it('hides live_score from the strip', () => {
    const out = dedupeActiveJobs([
      { id: 1, queue: 'live_score', status: 'queued', worker: null, error: null },
      { id: 2, queue: 'serp_crawl', status: 'queued', worker: null, error: null },
      { id: 3, queue: 'live_score', status: 'queued', worker: null, error: null },
    ]);
    expect(out.map((j) => j.queue)).toEqual(['serp_crawl']);
  });

  it('prefers running over queued for the same queue', () => {
    const out = dedupeActiveJobs([
      { id: 10, queue: 'coverage', status: 'queued', worker: null, error: null },
      { id: 11, queue: 'coverage', status: 'running', worker: 'coverage', error: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('running');
  });
});

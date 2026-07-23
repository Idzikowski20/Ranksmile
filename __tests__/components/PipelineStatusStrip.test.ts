import { dedupeActiveJobs } from '../../components/articles/PipelineStatusStrip';

describe('dedupeActiveJobs', () => {
  it('keeps one Live score chip when two are queued', () => {
    const out = dedupeActiveJobs([
      { id: 1, queue: 'live_score', status: 'queued', worker: null, error: null },
      { id: 2, queue: 'serp_crawl', status: 'queued', worker: null, error: null },
      { id: 3, queue: 'live_score', status: 'queued', worker: null, error: null },
    ]);
    expect(out.map((j) => j.queue)).toEqual(['live_score', 'serp_crawl']);
    expect(out.find((j) => j.queue === 'live_score')?.id).toBe(3);
  });

  it('prefers running over queued for the same queue', () => {
    const out = dedupeActiveJobs([
      { id: 10, queue: 'live_score', status: 'queued', worker: null, error: null },
      { id: 11, queue: 'live_score', status: 'running', worker: 'live_score', error: null },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe('running');
  });
});

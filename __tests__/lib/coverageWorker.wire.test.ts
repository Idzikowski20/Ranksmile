jest.mock('../../lib/corpus/corpusService', () => ({
  getCorpusById: jest.fn(async () => null),
}));

jest.mock('../../lib/features/serpCoverageFeatures', () => ({
  upsertSerpCoverageFeatures: jest.fn(async () => ({})),
}));

jest.mock('../../lib/pipeline/cacheLayers', () => ({
  cachePut: jest.fn(async () => undefined),
}));

describe('coverage worker product wire', () => {
  const prev = process.env.PIPELINE_STAGE;

  afterEach(() => {
    if (prev === undefined) delete process.env.PIPELINE_STAGE;
    else process.env.PIPELINE_STAGE = prev;
  });

  it('merges NER entityItems and skips planner at stage 0', async () => {
    process.env.PIPELINE_STAGE = '0';
    const { resetWorkerRegistry, getWorker } = await import('../../lib/workers/registry');
    resetWorkerRegistry();
    const coverage = getWorker('coverage');
    expect(coverage).toBeDefined();
    const result = await coverage!.execute({
      jobId: 1,
      jobKey: 'k',
      attempt: 0,
      pipelineVersion: 'v7',
      workerVersion: '2',
      payload: {
        keyword: 'test',
        terms: [{ term: 'foo bar', doc_freq: 5 }],
        entityItems: [
          {
            id: 'ent-1',
            label: 'OpenAI',
            type: 'entity',
            category: 'knowledge',
            importance: 'critical',
            source: 'competitors',
            covered: false,
            quality: 0,
            confidence: 0.9,
          },
        ],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.result?.entityCount).toBe(1);
    expect(result.nextQueue).toBeUndefined();
  });

  it('chains planner when stage >= 2', async () => {
    process.env.PIPELINE_STAGE = '2';
    const { resetWorkerRegistry, getWorker } = await import('../../lib/workers/registry');
    resetWorkerRegistry();
    const coverage = getWorker('coverage');
    const result = await coverage!.execute({
      jobId: 1,
      jobKey: 'k2',
      attempt: 0,
      pipelineVersion: 'v7',
      workerVersion: '2',
      payload: {
        keyword: 'test keyword',
        terms: [{ term: 'alpha', doc_freq: 8 }],
        paaQuestions: [{ question: 'Co to jest alpha beta gamma test?' }],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.nextQueue).toBe('planner');
  });
});

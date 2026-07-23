import {
  buildPipelinePayloadFromDeepAnalysis,
  enqueueFromDeepAnalysis,
} from '../../lib/pipeline/enqueueFromDeepAnalysis';

jest.mock('../../lib/pipeline/pipelineQueue', () => ({
  enqueueJob: jest.fn(async (opts: { queue: string; keyword: string }) => ({
    accepted: true,
    status: 202,
    jobKey: 'abc',
    jobId: 42,
    joinedExisting: false,
    queue: opts.queue,
  })),
}));

describe('enqueueFromDeepAnalysis', () => {
  it('builds serpUrls, terms, paa, documents from sidecar-shaped input', () => {
    const payload = buildPipelinePayloadFromDeepAnalysis({
      workspaceId: 'u1',
      articleId: 9,
      keyword: 'detektyw warszawa',
      language: 'pl',
      competitors: [
        { url: 'https://a.com/x', snippet: 'opis agencji', html: '<p>Hi</p>' },
        { url: 'https://b.com', text: 'więcej tekstu' },
      ],
      terms: [
        { term: 'detektyw', doc_freq: 8, target_count: 3 },
        { text: 'agencja', doc_freq: 4 },
      ],
      paaQuestions: ['Ile kosztuje detektyw?', { question: 'Jak wybrać detektywa?' }],
      citedCount: 2,
      promptCount: 10,
    });

    expect(payload.serpUrls).toEqual(['https://a.com/x', 'https://b.com']);
    expect(payload.terms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ term: 'detektyw', doc_freq: 8 }),
        expect.objectContaining({ term: 'agencja' }),
      ]),
    );
    expect(payload.paaQuestions).toHaveLength(2);
    expect(payload.documents).toHaveLength(2);
    expect(payload.articleId).toBe(9);
    expect(payload.citedCount).toBe(2);
  });

  it('enqueues serp_crawl and returns 202 shape', async () => {
    const result = await enqueueFromDeepAnalysis({
      workspaceId: 'u1',
      articleId: 1,
      keyword: 'seo tools',
      competitors: [{ url: 'https://example.com' }],
      terms: [{ term: 'seo' }],
    });
    expect(result).toEqual(
      expect.objectContaining({
        accepted: true,
        status: 202,
        jobId: 42,
        queue: 'serp_crawl',
      }),
    );
  });

  it('returns null without keyword', async () => {
    expect(
      await enqueueFromDeepAnalysis({
        workspaceId: 'u1',
        articleId: 1,
        keyword: '  ',
      }),
    ).toBeNull();
  });
});

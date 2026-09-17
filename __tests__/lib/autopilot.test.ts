import { decideAutopilotAction, MAX_ANALYSIS_ATTEMPTS, runAutopilotSweep } from '@/src/infrastructure/cron/autopilot';
import { queryRows } from '@/src/infrastructure/db/query';

jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('@/src/infrastructure/db/query', () => ({ queryRows: jest.fn() }));
jest.mock('@/src/infrastructure/articles/articleSql', () => ({ getArticleIdSql: jest.fn().mockResolvedValue('"ID"') }));
const mockForDomain = jest.fn();
jest.mock('@/src/infrastructure/billing/orgAccess', () => ({
  createBillingAccessCheck: () => ({ forDomain: mockForDomain, forOrg: jest.fn() }),
}));

function candidate(overrides: Partial<Parameters<typeof decideAutopilotAction>[0]> = {}) {
  return {
    articleId: 1,
    jobStatus: 'running',
    stale: false,
    attempts: 1,
    ...overrides,
  };
}

describe('decideAutopilotAction', () => {
  it('writes the article once its analysis is done', () => {
    expect(decideAutopilotAction(candidate({ jobStatus: 'done' }))).toBe('generate');
  });

  it('leaves a healthy in-flight analysis alone', () => {
    expect(decideAutopilotAction(candidate({ jobStatus: 'running' }))).toBe('skip');
    expect(decideAutopilotAction(candidate({ jobStatus: 'queued' }))).toBe('skip');
  });

  it('restarts a failed analysis', () => {
    expect(decideAutopilotAction(candidate({ jobStatus: 'failed' }))).toBe('retry_analysis');
  });

  it('restarts an analysis whose request died mid-flight', () => {
    expect(decideAutopilotAction(candidate({ jobStatus: 'running', stale: true }))).toBe('retry_analysis');
    expect(decideAutopilotAction(candidate({ jobStatus: 'finalizing', stale: true }))).toBe('retry_analysis');
  });

  it('gives up on a topic after the attempt cap', () => {
    expect(decideAutopilotAction(candidate({ jobStatus: 'failed', attempts: MAX_ANALYSIS_ATTEMPTS }))).toBe('skip');
    expect(decideAutopilotAction(candidate({ jobStatus: 'running', stale: true, attempts: MAX_ANALYSIS_ATTEMPTS }))).toBe('skip');
  });

  it('still writes a finished article that hit the attempt cap on the way', () => {
    expect(decideAutopilotAction(candidate({ jobStatus: 'done', attempts: MAX_ANALYSIS_ATTEMPTS }))).toBe('generate');
  });
});

describe('runAutopilotSweep billing', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValue({ ok: true });
    (queryRows as jest.Mock).mockResolvedValue([
      { article_id: 5, status: 'done', stale: 0, domain_id: 9, target_keyword: 'seo', attempts: 1 },
    ]);
  });

  it('writes the article for an org with billing access', async () => {
    mockForDomain.mockResolvedValue(true);
    const res = await runAutopilotSweep({ baseUrl: 'http://x', cronSecret: 's' });
    expect(res.generated).toEqual([5]);
  });

  it('skips an org without billing access', async () => {
    mockForDomain.mockResolvedValue(false);
    const res = await runAutopilotSweep({ baseUrl: 'http://x', cronSecret: 's' });
    expect(mockForDomain).toHaveBeenCalledWith(9);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res).toEqual({ generated: [], retried: [], skipped: 1 });
  });
});

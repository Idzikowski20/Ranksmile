import { decideAutopilotAction, MAX_ANALYSIS_ATTEMPTS } from '../../lib/autopilot';

jest.mock('../../database/database', () => ({ __esModule: true, default: { query: jest.fn() } }));

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

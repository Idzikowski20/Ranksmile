/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react';
import { jobArticleId, useBackgroundDeepAnalysis } from '../../hooks/useBackgroundDeepAnalysis';

const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as unknown as typeof fetch;
  sessionStorage.clear();

  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/api/articles/job-progress')) {
      return Promise.resolve({ ok: false, status: 404 });
    }
    if (url.includes('/api/articles/deep-analysis')) {
      return Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: async () => ({ done: true, value: undefined }),
          }),
        },
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
});

describe('jobArticleId', () => {
  it('parses article id from job id', () => {
    expect(jobArticleId('job_67_1783432792666')).toBe(67);
    expect(jobArticleId('bad')).toBeNull();
  });
});

describe('useBackgroundDeepAnalysis strict-mode remount', () => {
  it('starts analysis again after cleanup (reactStrictMode double mount)', async () => {
    const props = {
      articleId: 67,
      articleStatus: 'analyzing' as const,
      metaUrl: 'https://example.com/page',
      targetKeyword: 'test kw',
      enabled: true,
      onComplete: jest.fn(),
    };

    const { unmount } = renderHook(() => useBackgroundDeepAnalysis(props));
    unmount();
    renderHook(() => useBackgroundDeepAnalysis(props));

    await waitFor(() => {
      const deepCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/articles/deep-analysis'));
      expect(deepCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('sends articleId (not existingArticleId) to deep-analysis API', async () => {
    renderHook(() => useBackgroundDeepAnalysis({
      articleId: 67,
      articleStatus: 'analyzing',
      metaUrl: 'https://example.com/page',
      targetKeyword: 'test kw',
      enabled: true,
      onComplete: jest.fn(),
    }));

    await waitFor(() => {
      const deepCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/articles/deep-analysis'));
      expect(deepCall).toBeDefined();
      const body = JSON.parse((deepCall![1] as RequestInit).body as string);
      expect(body.articleId).toBe(67);
      expect(body.existingArticleId).toBeUndefined();
    });
  });

  it('stops polling on 401 without restarting', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('articleId=67')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            jobId: 'job_67_123',
            status: 'running',
            currentStage: 'scrape_serp',
            progressMessage: 'Scraping SERP',
            updatedAt: new Date().toISOString(),
          }),
        });
      }
      if (url.includes('jobId=job_67_123')) {
        return Promise.resolve({ ok: false, status: 401 });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    const onError = jest.fn();
    renderHook(() => useBackgroundDeepAnalysis({
      articleId: 67,
      articleStatus: 'analyzing',
      metaUrl: 'https://example.com/page',
      targetKeyword: 'test kw',
      enabled: true,
      onComplete: jest.fn(),
      onError,
    }));

    await waitFor(() => expect(onError).toHaveBeenCalled(), { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 2500));
    const deepCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/api/articles/deep-analysis'));
    expect(deepCalls.length).toBe(0);
  });
});

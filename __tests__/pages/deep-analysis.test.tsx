import type { ReactNode } from 'react';
import { TextDecoder as NodeTextDecoder } from 'util';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DeepAnalysisPage from '../../pages/articles/deep-analysis';

global.TextDecoder = NodeTextDecoder as unknown as typeof global.TextDecoder;

const routerPush = jest.fn();
const routerReplace = jest.fn();
const mockRouter = {
  isReady: true,
  query: { url: 'https://example.com/article', flow: 'new' },
  push: routerPush,
  replace: routerReplace,
};

jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('../../components/articles/WizardShell', () => ({
  __esModule: true,
  default: ({ children, footer }: { children: ReactNode; footer?: ReactNode }) => (
    <main>{children}<footer>{footer}</footer></main>
  ),
  WizardNextButton: ({ label, onClick, disabled }: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  }) => <button type="button" onClick={onClick} disabled={disabled}>{label}</button>,
}));

function response(body: Record<string, unknown>): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

function errorResponse(body: Record<string, unknown>): Response {
  return { ok: false, json: async () => body } as unknown as Response;
}

function streamResponse(payload: string): Response {
  const bytes = Buffer.from(payload, 'utf8');
  let sent = false;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => {
          if (sent) return { done: true, value: undefined };
          sent = true;
          return { done: false, value: bytes };
        },
      }),
    },
  } as unknown as Response;
}

function deferredStreamResponse(): { response: Response; release: (payload: string) => void; finish: () => void } {
  type StreamReadResult =
    | { done: false; value: Uint8Array }
    | { done: true; value: undefined };

  let resolveRead: ((result: StreamReadResult) => void) | null = null;
  const pending: StreamReadResult[] = [];

  const push = (result: StreamReadResult) => {
    if (!resolveRead) {
      pending.push(result);
      return;
    }
    const resolve = resolveRead;
    resolveRead = null;
    resolve(result);
  };

  return {
    response: {
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (pending.length > 0) {
              return Promise.resolve(pending.shift() as StreamReadResult);
            }
            return new Promise<StreamReadResult>((resolve) => { resolveRead = resolve; });
          },
        }),
      },
    } as unknown as Response,
    release: (payload: string) => {
      push({ done: false, value: Buffer.from(payload, 'utf8') });
    },
    finish: () => push({ done: true, value: undefined }),
  };
}

function deferredPromise<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolvePromise: ((value: T) => void) | null = null;
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve; });
  return {
    promise,
    resolve: (value) => {
      if (!resolvePromise) throw new Error('Deferred promise is not ready');
      resolvePromise(value);
    },
  };
}

describe('DeepAnalysisPage', () => {
  beforeEach(() => {
    routerPush.mockReset();
    routerReplace.mockReset();
    sessionStorage.clear();
    fetchMock.resetMocks();
  });

  it('enables Content type after the job is created and keeps analysis running', async () => {
    const stream = deferredStreamResponse();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url === '/api/articles/deep-analysis') {
        return Promise.resolve(stream.response);
      }
      if (url === '/api/articles/job-progress?articleId=177') {
        return Promise.resolve(response({ status: 'running', currentStage: 'fetch_page' }));
      }
      if (url === '/api/articles/job-progress?jobId=job_177_1') {
        return Promise.resolve(response({ status: 'running', currentStage: 'fetch_page' }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { container, unmount } = render(<DeepAnalysisPage />);
    const next = screen.getByRole('button', { name: 'Content type' });
    expect(next).toBeDisabled();

    expect(container.querySelectorAll('.deep-analysis-step--pending')).toHaveLength(8);
    expect(container.querySelectorAll('.deep-analysis-step-icon__pending')).toHaveLength(8);
    await act(async () => {
      stream.release('event: created\ndata: {"articleId":177}\n\n');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/articles/job-progress?articleId=177'));
    expect(next).toBeDisabled();

    await act(async () => {
      stream.release('event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n');
    });
    await waitFor(() => expect(container.querySelectorAll('.deep-analysis-step')).toHaveLength(8));
    await waitFor(() => expect(container.querySelector('.deep-analysis-step--running [role="status"]')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/articles/job-progress?jobId=job_177_1');

    await waitFor(() => expect(next).toBeEnabled());
    expect(container.querySelector('.deep-analysis-pipeline-live')).not.toBeInTheDocument();
    expect(container.querySelector('.deep-analysis-progress')).not.toBeInTheDocument();

    fireEvent.click(next);
    expect(routerPush).toHaveBeenCalledWith('/articles/content-type?articleId=177');
    unmount();
  });

  it('renders a failed step and leaves retry available', async () => {
    fetchMock.mockResolvedValue(streamResponse(
      'event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n'
      + 'event: error\ndata: {"step":"pipeline","message":"Fetch failed"}\n\n',
    ));

    const { container } = render(<DeepAnalysisPage />);

    await waitFor(() => expect(container.querySelector('.deep-analysis-step--error')).toBeInTheDocument());
    const errorRow = container.querySelector<HTMLElement>('.deep-analysis-step--error');
    if (!errorRow) throw new Error('Expected fetch step to be in the error state');
    expect(within(errorRow).getByText('Fetching page content')).toBeInTheDocument();
    expect(errorRow).toHaveTextContent('Fetch failed');
    expect(errorRow.querySelector('.deep-analysis-step-icon__error')).toBeInTheDocument();
    expect(container.querySelectorAll('.deep-analysis-step--pending')).toHaveLength(7);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('retries the failed article without stale polling poisoning the new run', async () => {
    const firstStream = deferredStreamResponse();
    const retryStream = deferredStreamResponse();
    const stalePoll = deferredPromise<Response>();
    let deepAnalysisCalls = 0;

    fetchMock.mockImplementation((input) => {
      const requestUrl = String(input);
      if (requestUrl === '/api/articles/deep-analysis') {
        deepAnalysisCalls += 1;
        return Promise.resolve(deepAnalysisCalls === 1 ? firstStream.response : retryStream.response);
      }
      if (requestUrl === '/api/articles/job-progress?jobId=job_177_1') return stalePoll.promise;
      if (requestUrl === '/api/articles/job-progress?jobId=job_177_2') {
        return Promise.resolve(response({ status: 'running', currentStage: 'scrape_serp' }));
      }
      throw new Error(`Unexpected fetch: ${requestUrl}`);
    });

    const { unmount } = render(<DeepAnalysisPage />);
    const next = screen.getByRole('button', { name: 'Content type' });

    await act(async () => {
      firstStream.release('event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/articles/job-progress?jobId=job_177_1'));
    await act(async () => {
      firstStream.release('event: error\ndata: {"step":"pipeline","message":"Initial pipeline failed"}\n\n');
      firstStream.finish();
    });

    await waitFor(() => expect(screen.getByText('Initial pipeline failed')).toBeInTheDocument());
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(next).toBeDisabled();

    await waitFor(() => expect(deepAnalysisCalls).toBe(2));
    const retryPost = fetchMock.mock.calls.filter(([requestUrl]) => requestUrl === '/api/articles/deep-analysis')[1];
    const retryBody = JSON.parse((retryPost[1] as RequestInit).body as string) as Record<string, unknown>;
    expect(retryBody.articleId).toBe(177);

    await act(async () => {
      retryStream.release('event: created\ndata: {"articleId":177,"jobId":"job_177_2"}\n\n');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/articles/job-progress?jobId=job_177_2'));
    await act(async () => {
      stalePoll.resolve(response({
        jobId: 'job_177_1',
        status: 'failed',
        currentStage: 'fetch_page',
        progressMessage: 'Stale job failed',
      }));
    });

    await waitFor(() => expect(next).toBeEnabled());
    expect(screen.queryByText('Stale job failed')).not.toBeInTheDocument();
    expect(deepAnalysisCalls).toBe(2);

    await act(async () => { retryStream.finish(); });
    unmount();
  });

  it('keeps the failed article recovery action when retry fails before creating a job', async () => {
    const firstStream = deferredStreamResponse();
    let deepAnalysisCalls = 0;

    fetchMock.mockImplementation((input) => {
      const requestUrl = String(input);
      if (requestUrl === '/api/articles/deep-analysis') {
        deepAnalysisCalls += 1;
        return Promise.resolve(deepAnalysisCalls === 1
          ? firstStream.response
          : errorResponse({ error: 'Retry request failed' }));
      }
      if (requestUrl === '/api/articles/job-progress?jobId=job_177_1') {
        return Promise.resolve(response({ status: 'running', currentStage: 'fetch_page' }));
      }
      throw new Error(`Unexpected fetch: ${requestUrl}`);
    });

    const { unmount } = render(<DeepAnalysisPage />);

    await act(async () => {
      firstStream.release('event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n');
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/articles/job-progress?jobId=job_177_1'));
    await act(async () => {
      firstStream.release('event: error\ndata: {"step":"pipeline","message":"Initial pipeline failed"}\n\n');
      firstStream.finish();
    });

    await waitFor(() => expect(screen.getByText('Initial pipeline failed')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(screen.getByText('Retry request failed')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open article' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Content type' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Open article' }));
    expect(routerPush).toHaveBeenCalledWith('/articles/177');
    unmount();
  });

  it('marks the polling stage row when a background job fails', async () => {
    fetchMock.mockImplementation((input) => {
      const requestUrl = String(input);
      if (requestUrl === '/api/articles/deep-analysis') {
        return Promise.resolve(streamResponse(
          'event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n',
        ));
      }
      if (requestUrl === '/api/articles/job-progress?jobId=job_177_1') {
        return Promise.resolve(response({
          status: 'failed',
          currentStage: 'scrape_serp',
          error: 'SERP collection failed',
          progressMessage: 'Scraping competitor 7/10',
        }));
      }
      throw new Error(`Unexpected fetch: ${requestUrl}`);
    });

    const { container } = render(<DeepAnalysisPage />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('SERP collection failed'));
    const errorRows = container.querySelectorAll<HTMLElement>('.deep-analysis-step--error');
    expect(errorRows).toHaveLength(1);
    expect(errorRows[0]).toHaveTextContent('Analyzing SERP competitors');
    expect(errorRows[0]).toHaveTextContent('SERP collection failed');
    expect(screen.getByRole('alert')).toHaveTextContent('SERP collection failed');
    expect(screen.queryByText('Scraping competitor 7/10')).not.toBeInTheDocument();
  });

  it('persists a job discovered by article polling and resumes it after remount', async () => {
    let deepAnalysisCalls = 0;
    fetchMock.mockImplementation((input) => {
      const requestUrl = String(input);
      if (requestUrl === '/api/articles/deep-analysis') {
        deepAnalysisCalls += 1;
        return Promise.resolve(streamResponse(
          'event: created\ndata: {"articleId":177}\n\n',
        ));
      }
      if (requestUrl === '/api/articles/job-progress?articleId=177') {
        return Promise.resolve(response({
          jobId: 'job_177_1',
          status: 'running',
          currentStage: 'scrape_serp',
        }));
      }
      if (requestUrl === '/api/articles/job-progress?jobId=job_177_1') {
        return Promise.resolve(response({
          jobId: 'job_177_1',
          status: 'running',
          currentStage: 'scrape_serp',
        }));
      }
      throw new Error(`Unexpected fetch: ${requestUrl}`);
    });

    const first = render(<DeepAnalysisPage />);

    await waitFor(() => {
      expect(sessionStorage.getItem(
        'ranksmile-deep-analysis-page:new:https://example.com/article::',
      )).toBe(JSON.stringify({ articleId: 177, jobId: 'job_177_1' }));
    });
    first.unmount();

    const second = render(<DeepAnalysisPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/articles/job-progress?jobId=job_177_1'));
    expect(deepAnalysisCalls).toBe(1);
    second.unmount();
  });

  it('marks every row complete when the background job finishes', async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url === '/api/articles/deep-analysis') {
        return Promise.resolve(streamResponse(
          'event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n',
        ));
      }
      if (url === '/api/articles/job-progress?jobId=job_177_1') {
        return Promise.resolve(response({ status: 'done', currentStage: 'done' }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { container } = render(<DeepAnalysisPage />);

    await waitFor(() => {
      expect(container.querySelectorAll('.deep-analysis-step--done')).toHaveLength(8);
      expect(container.querySelectorAll('.deep-analysis-step-icon__done')).toHaveLength(8);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/articles/job-progress?jobId=job_177_1');
  });
});

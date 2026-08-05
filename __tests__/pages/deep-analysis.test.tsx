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

function deferredStreamResponse(): { response: Response; release: (payload: string) => void } {
  type StreamReadResult =
    | { done: false; value: Uint8Array }
    | { done: true; value: undefined };

  let resolveRead: ((result: StreamReadResult) => void) | null = null;
  const pending: Uint8Array[] = [];

  return {
    response: {
      ok: true,
      body: {
        getReader: () => ({
          read: () => {
            if (pending.length > 0) {
              return Promise.resolve({ done: false, value: pending.shift() as Uint8Array } as const);
            }
            return new Promise<StreamReadResult>((resolve) => { resolveRead = resolve; });
          },
        }),
      },
    } as unknown as Response,
    release: (payload: string) => {
      const bytes = Buffer.from(payload, 'utf8');
      if (!resolveRead) {
        pending.push(bytes);
        return;
      }
      const resolve = resolveRead;
      resolveRead = null;
      resolve({ done: false, value: bytes });
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
      + 'event: error\ndata: {"step":"fetch","message":"Fetch failed"}\n\n',
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

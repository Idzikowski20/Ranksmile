import type { ReactNode } from 'react';
import { TextDecoder as NodeTextDecoder } from 'util';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
jest.mock('../../services/domains', () => ({
  useFetchDomains: () => ({ data: { domains: [] } }),
}));
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
jest.mock('../../components/common/DashboardLayout', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('../../components/ranksmile/AnalysisCircuitBoard', () => ({
  __esModule: true,
  default: () => <div data-testid="analysis-circuit" />,
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

describe('DeepAnalysisPage', () => {
  beforeEach(() => {
    routerPush.mockReset();
    routerReplace.mockReset();
    sessionStorage.clear();
    fetchMock.resetMocks();
  });

  it('enables Content type after the job is created and keeps analysis running', async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/articles/deep-analysis')) {
        return Promise.resolve(streamResponse(
          'event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n',
        ));
      }
      return Promise.resolve(response({ status: 'running', currentStage: 'fetch_page' }));
    });

    const { container, unmount } = render(<DeepAnalysisPage />);
    const next = screen.getByRole('button', { name: 'Content type' });

    expect(next).toBeDisabled();
    expect(container.querySelectorAll('.deep-analysis-step--pending')).toHaveLength(8);
    expect(container.querySelectorAll('.deep-analysis-step-icon__pending')).toHaveLength(8);
    await waitFor(() => expect(next).toBeEnabled());
    await waitFor(() => expect(container.querySelectorAll('.deep-analysis-step')).toHaveLength(8));
    await waitFor(() => expect(container.querySelector('.deep-analysis-step--running [role="status"]')).toBeInTheDocument());
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

    expect(await screen.findAllByText('Fetch failed')).not.toHaveLength(0);
    expect(container.querySelector('.deep-analysis-step--error')).toBeInTheDocument();
    expect(container.querySelector('.deep-analysis-step-icon__error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
  });

  it('marks every row complete when the background job finishes', async () => {
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/articles/deep-analysis')) {
        return Promise.resolve(streamResponse(
          'event: created\ndata: {"articleId":177,"jobId":"job_177_1"}\n\n',
        ));
      }
      return Promise.resolve(response({ status: 'done', currentStage: 'done' }));
    });

    const { container } = render(<DeepAnalysisPage />);

    await waitFor(() => {
      expect(container.querySelectorAll('.deep-analysis-step--done')).toHaveLength(8);
      expect(container.querySelectorAll('.deep-analysis-step-icon__done')).toHaveLength(8);
    });
  });
});

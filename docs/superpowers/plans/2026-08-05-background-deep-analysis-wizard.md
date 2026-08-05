# Background Deep Analysis Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users continue from Deep Analysis as soon as its article job exists, while replacing the animated progress presentation with eight compact Koala status rows.

**Architecture:** Keep the current SSE start, persisted `{ articleId, jobId }`, polling, retry, and completion redirect. Render the page inside the existing New Content `WizardShell`, enable its standard footer CTA after the `created` event, and rely on the existing editor `useBackgroundDeepAnalysis` hook to discover the same job and keep the editor locked until completion.

**Tech Stack:** Next.js 12, React 18, TypeScript, Jest, Testing Library, Koala UI primitives, CSS semantic tokens.

---

## File map

- Create `__tests__/pages/deep-analysis.test.tsx`: page-level regression coverage for early navigation and status-row rendering.
- Modify `pages/articles/deep-analysis.tsx`: reuse the wizard shell, remove the circuit/progress presentation, and add the early Content Type action.
- Modify `styles/globals.css`: turn each existing deep-analysis step into the approved bordered row and delete styles for removed UI.
- Update `graphify-out/`: refresh the repository graph after code changes, as required by `AGENTS.md`.

### Task 1: Prove early navigation and status rendering

**Files:**
- Create: `__tests__/pages/deep-analysis.test.tsx`

- [ ] **Step 1: Write the failing page test**

Create a typed stream-response helper and mock only the page shell and unrelated layout dependencies. The test must render the real Deep Analysis page logic:

```tsx
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeepAnalysisPage from '../../pages/articles/deep-analysis';

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
```

- [ ] **Step 2: Run the test and verify the requested behavior is missing**

Run:

```powershell
npx jest __tests__/pages/deep-analysis.test.tsx --runInBand
```

Expected: FAIL because the current page has no `Content type` footer button and still renders the circuit/progress UI.

- [ ] **Step 3: Commit the failing regression test**

```powershell
git add __tests__/pages/deep-analysis.test.tsx
git commit -m "test: cover background deep analysis navigation"
```

### Task 2: Reuse the wizard shell and allow navigation after job creation

**Files:**
- Modify: `pages/articles/deep-analysis.tsx:1-482`
- Test: `__tests__/pages/deep-analysis.test.tsx`

- [ ] **Step 1: Replace page-specific layout imports with the shared wizard shell**

Keep `Alert`, `Button`, `Icon`, and `Spinner`. Remove `Head`, `DashboardLayout`, Koala page/panel components, `StatusBadge`, `AnalysisCircuitBoard`, `DeepAnalysisUiState`, `StepVisualStatus`, and `useFetchDomains`. Add:

```tsx
import WizardShell, { WizardNextButton } from '../../components/articles/WizardShell';
```

Remove the domains query because `WizardShell` already owns it.

- [ ] **Step 2: Delete presentation-only progress state**

Remove `apiProgressPct`, the `totalProgress` assignment, `completedCount`, `progressPct`, `circuitState`, `statusBadge`, and their retry resets. Keep `steps`, `articleId`, `jobId`, `overallError`, `allDone`, SSE handling, polling, retry, session storage, the import redirect, and the automatic completion redirect unchanged.

- [ ] **Step 3: Render the approved status list and footer**

Replace the current return tree with:

```tsx
  const canContinue = articleId !== null && jobId !== null;
  const continueToContentType = () => {
    if (!articleId) return;
    void router.push(`/articles/content-type?articleId=${articleId}`);
  };

  return (
    <WizardShell
      title="Deep analysis"
      footer={(
        <WizardNextButton
          label="Content type"
          disabled={!canContinue}
          onClick={continueToContentType}
        />
      )}
    >
      <div>
        <h2 className="koala-wizard-title">Deep analysis</h2>
        <p className="koala-wizard-subtitle">{subtitle}</p>
      </div>

      <div className="deep-analysis-steps" aria-label="Deep analysis progress" aria-live="polite">
        {steps.map((step) => <StepRow key={step.key} step={step} />)}
      </div>

      {overallError && (
        <Alert variant="error" title="Analysis failed">
          {overallError}
          <div className="deep-analysis-actions">
            <Button variant="primary" size="sm" onClick={handleRetry}>Try again</Button>
            {articleId && (
              <Button variant="secondary" size="sm" onClick={() => router.push(`/articles/${articleId}`)}>
                Open article
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => router.push(backHref)}>
              {backLabel}
            </Button>
          </div>
        </Alert>
      )}
    </WizardShell>
  );
```

Use this subtitle default while keeping the existing complete and error variants:

```tsx
return 'We are analyzing your content. You can continue while it runs in the background.';
```

- [ ] **Step 4: Run the page regression test**

Run:

```powershell
npx jest __tests__/pages/deep-analysis.test.tsx --runInBand
```

Expected: PASS, with the button initially disabled, enabled after the SSE `created` event, and routing to article 177.

- [ ] **Step 5: Commit the behavior change**

```powershell
git add pages/articles/deep-analysis.tsx __tests__/pages/deep-analysis.test.tsx
git commit -m "feat: continue while deep analysis runs"
```

### Task 3: Style the eight steps as Koala status rows

**Files:**
- Modify: `styles/globals.css:4582-4694`

- [ ] **Step 1: Remove CSS for deleted presentation elements**

Delete selectors for `.deep-analysis-panel`, `.deep-analysis-pipeline-live`, `.deep-analysis-pipeline-status`, `.deep-analysis-pct`, `.deep-analysis-progress`, `.deep-analysis-progress-fill`, `.deep-analysis-steps--complete`, and `.deep-analysis-complete-alert`.

- [ ] **Step 2: Replace step styles with the approved row layout**

Use only existing Koala semantic tokens and retain `.deep-analysis-actions`:

```css
.deep-analysis-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.deep-analysis-step {
  min-height: 56px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--koala-border-primary);
  border-radius: var(--radius-xl);
  background: var(--koala-bg-secondary);
  box-sizing: border-box;
}
.deep-analysis-step-icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.deep-analysis-step-label {
  min-width: 0;
  font-size: 14px;
  line-height: 20px;
  font-weight: 500;
  color: var(--koala-text-primary);
  font-family: var(--font-family-primary);
}
.deep-analysis-step--pending .deep-analysis-step-label {
  color: var(--koala-text-secondary);
}
.deep-analysis-step--running .deep-analysis-step-label {
  font-weight: 600;
}
.deep-analysis-step--error {
  border-color: var(--koala-status-danger);
}
.deep-analysis-step--error .deep-analysis-step-label {
  color: var(--koala-status-danger);
}
.deep-analysis-step-error {
  min-width: 0;
  font-size: 12px;
  color: var(--koala-status-danger);
  font-family: var(--font-family-primary);
}
```

Do not add opacity or transition rules; the only continuing motion is the explicitly requested Koala spinner.

- [ ] **Step 3: Run UI token and page checks**

Run:

```powershell
npm run check:koala-tokens
npx jest __tests__/pages/deep-analysis.test.tsx --runInBand
```

Expected: both commands PASS.

- [ ] **Step 4: Commit the visual change**

```powershell
git add styles/globals.css
git commit -m "style: simplify deep analysis progress"
```

### Task 4: Verify editor locking and refresh the knowledge graph

**Files:**
- Verify: `__tests__/hooks/useBackgroundDeepAnalysis.test.ts`
- Update: `graphify-out/`

- [ ] **Step 1: Run the page and editor-background regression tests together**

Run:

```powershell
npx jest __tests__/pages/deep-analysis.test.tsx __tests__/hooks/useBackgroundDeepAnalysis.test.ts --runInBand
```

Expected: PASS; page navigation and background-job discovery both remain covered.

- [ ] **Step 2: Run TypeScript and Koala token verification**

Run:

```powershell
npm run typecheck
npm run check:koala-tokens
```

Expected: both commands exit 0.

- [ ] **Step 3: Refresh graphify after code changes**

Run:

```powershell
graphify update .
```

Expected: graph update completes without an API call.

- [ ] **Step 4: Inspect the final diff**

Run:

```powershell
git diff --check origin/main...HEAD
git status --short
```

Expected: no whitespace errors and only the spec, plan, page test, Deep Analysis page, intended CSS, and graphify refresh are present.

- [ ] **Step 5: Commit generated graph metadata only if it changed**

If `git status --short graphify-out` reports changes, run:

```powershell
git add graphify-out
git commit -m "chore: refresh code graph"
```

If it reports no changes, do not create an empty commit.

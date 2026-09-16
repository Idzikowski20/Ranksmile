/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import DomainSetupProgressBar, { setupSteps } from '../../components/dashboard/DomainSetupProgressBar';
import type { SetupStatus } from '../../services/domainPipeline';

const status = (over: Partial<SetupStatus> = {}): SetupStatus => ({
  status: 'running',
  currentStage: 'topics',
  stagePercent: 40,
  stages: { gsc: 'done', keywords: 'done', topics: 'running', competitors: 'pending', recommendations: 'pending' },
  error: null,
  auditCounts: null,
  ...over,
});

it('maps the job row onto the five stages, with the running stage\'s own percent', () => {
  const steps = setupSteps(status());
  expect(steps.map((s) => s.state)).toEqual(['done', 'done', 'active', 'idle', 'idle']);
  expect(steps[2].detail).toBe('40%');
  // 0 and 100 say nothing a spinner or a tick does not already say.
  expect(setupSteps(status({ stagePercent: 0 }))[2].detail).toBeUndefined();
  expect(setupSteps(status({ stagePercent: 100 }))[2].detail).toBeUndefined();
});

it('adds a Site Speed step to the campaign only when PageSpeed is configured', () => {
  // Hidden when the key is absent ('off' or the field missing on an older payload).
  expect(setupSteps(status({ siteSpeed: 'off' })).map((s) => s.label)).not.toContain('Measuring site speed');
  expect(setupSteps(status()).map((s) => s.label)).not.toContain('Measuring site speed');
  // Shown as the sixth step, active while measuring and done once finished.
  const running = setupSteps(status({ siteSpeed: 'running' }));
  expect(running).toHaveLength(6);
  expect(running[5]).toMatchObject({ label: 'Measuring site speed', state: 'active' });
  expect(setupSteps(status({ siteSpeed: 'done' }))[5].state).toBe('done');
});

it('keeps the Site Speed step idle while the job is only queued, so the first stage still reads as waiting', () => {
  const queued = status({
    status: 'queued',
    stagePercent: 0,
    stages: { gsc: 'pending', keywords: 'pending', topics: 'pending', competitors: 'pending', recommendations: 'pending' },
    siteSpeed: 'running',
  });
  expect(setupSteps(queued)[5].state).toBe('idle');
  render(<DomainSetupProgressBar onRetry={() => undefined} setup={queued} />);
  expect(screen.getByRole('status')).toHaveTextContent('Getting Search Console and site data · queued');
});

it('leaves once the job is done', () => {
  const { rerender } = render(<DomainSetupProgressBar setup={status()} onRetry={() => undefined} />);
  expect(screen.getByRole('status')).toHaveTextContent('Clustering and modeling topics · 40%');
  expect(screen.getByText('2 of 5 steps done')).toBeInTheDocument();

  rerender(<DomainSetupProgressBar setup={status({ status: 'done' })} onRetry={() => undefined} />);
  expect(screen.queryByRole('status')).toBeNull();
});

it('names the first stage as waiting while the job is still queued', () => {
  render(<DomainSetupProgressBar onRetry={() => undefined} setup={status({
    status: 'queued',
    stagePercent: 0,
    stages: { gsc: 'pending', keywords: 'pending', topics: 'pending', competitors: 'pending', recommendations: 'pending' },
  })} />);
  expect(screen.getByRole('status')).toHaveTextContent('Getting Search Console and site data · queued');
});

/** Retry lives in the pill too — the failed run is the one state that needs a control. */
it('keeps the pill on failure, marks the stage it died in, and offers Retry', () => {
  const onRetry = jest.fn();
  render(<DomainSetupProgressBar setup={status({ status: 'failed', error: 'GSC token expired' })} onRetry={onRetry} />);

  expect(screen.getByRole('status')).toHaveTextContent('GSC token expired');
  expect(screen.getByText("We couldn't finish analyzing your domain")).toBeInTheDocument();
  // The timeline marks the stage the job died in — the two before it stay done.
  expect(setupSteps(status({ status: 'failed' })).map((s) => s.state))
    .toEqual(['done', 'done', 'active', 'idle', 'idle']);
  const failed = screen.getByText('Clustering and modeling topics').closest('div')?.parentElement;
  expect(failed).toBeTruthy();
  screen.getByRole('button', { name: 'Retry' }).click();
  expect(onRetry).toHaveBeenCalledTimes(1);
});

/** The stage a failed job died in is the one the timeline marks, not the first row. */
it('marks the stage the job died in as failed', () => {
  const { container } = render(
    <DomainSetupProgressBar onRetry={() => undefined} setup={status({ status: 'failed', error: 'boom' })} />,
  );
  // The row that died carries the danger marker; the ones before it keep their ticks.
  const states = Array.from(container.querySelectorAll('[data-pill-state]'))
    .map((n) => n.getAttribute('data-pill-state'));
  expect(states).toEqual(['done', 'done', 'failed', 'idle', 'idle']);
  expect(screen.getByText('Clustering and modeling topics')).toBeInTheDocument();
});

/** Materialization keeps the job open; dropping the pill there claimed it had finished. */
it('stays up while the job is finalizing', () => {
  render(<DomainSetupProgressBar onRetry={() => undefined} setup={status({ status: 'finalizing' })} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});

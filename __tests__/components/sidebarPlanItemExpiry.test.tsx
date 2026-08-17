import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';

const fetchJson = jest.fn();
jest.mock('../../lib/fetchJson', () => ({
  __esModule: true,
  default: (...args: unknown[]) => fetchJson(...args),
}));

import { SidebarPlanItem } from '../../components/koala/shell/SidebarPlanItem';

/**
 * The first re-ask after the countdown hits zero often still answers `trialing`: the
 * server grants a grace window and the Stripe webhook may not have landed. A one-shot
 * guard stopped there, so the sidebar sat on "Trial · 0m" until a full reload. The
 * re-ask must repeat while the stale answer persists.
 */
describe('SidebarPlanItem — expired trial keeps re-asking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fetchJson.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('invalidates bootstrap again after the interval when the answer is still trialing', async () => {
    fetchJson.mockResolvedValue({
      summary: {
        planSlug: 'growth', planName: 'Growth', billingPeriod: null,
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() - 60_000).toISOString(),
        currentPeriodEnd: null, metrics: [], overallPct: 0,
      },
      statusLine: '',
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidate = jest.spyOn(client, 'invalidateQueries');

    render(
      <QueryClientProvider client={client}>
        <SidebarPlanItem />
      </QueryClientProvider>,
    );
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(/Trial ·/)).toBeInTheDocument();

    const bootstrapCalls = () => invalidate.mock.calls
      .filter(([key]) => JSON.stringify(key) === JSON.stringify(['bootstrap'])).length;

    // Deadline already passed — the first tick fires the first re-ask.
    await act(async () => { jest.advanceTimersByTime(31_000); });
    expect(bootstrapCalls()).toBe(1);

    // Still `trialing` five minutes later — it must ask again, not stop at one.
    await act(async () => { jest.advanceTimersByTime(5 * 60_000 + 31_000); });
    expect(bootstrapCalls()).toBeGreaterThanOrEqual(2);
  });
});

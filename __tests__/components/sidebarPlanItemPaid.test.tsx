import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import type { PlanSummaryData } from '../../lib/planLimits';

const fetchJson = jest.fn();
jest.mock('../../lib/fetchJson', () => ({
  __esModule: true,
  default: (...args: unknown[]) => fetchJson(...args),
}));

import { SidebarPlanItem } from '../../components/koala/shell/SidebarPlanItem';

function summary(over: Partial<PlanSummaryData>): PlanSummaryData {
  return {
    planSlug: 'growth', planName: 'Growth', billingPeriod: 'monthly',
    subscriptionStatus: 'active', trialEndsAt: null,
    currentPeriodEnd: '2026-09-15T17:01:12.000Z', cancelAtPeriodEnd: false,
    metrics: [{ key: 'documents', label: 'Documents', limit: 30, used: 3, pct: 10 }],
    overallPct: 10,
    ...over,
  };
}

function renderWidget(s: PlanSummaryData, statusLine = 'Billed monthly · Active') {
  fetchJson.mockResolvedValue({ summary: s, statusLine });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SidebarPlanItem />
    </QueryClientProvider>,
  );
}

beforeEach(() => fetchJson.mockReset());

describe('SidebarPlanItem — active paid widget', () => {
  it('names the plan and shows the renewal date, with an upgrade CTA on Growth', async () => {
    renderWidget(summary({ planSlug: 'growth', planName: 'Growth' }));
    await waitFor(() => expect(screen.getByText('Growth plan')).toBeInTheDocument());
    expect(screen.getByText('Renews Sep 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('Upgrade now')).toBeInTheDocument();
    expect(screen.getByText('See limits')).toBeInTheDocument();
  });

  it('says Ends when the subscription is set to cancel', async () => {
    renderWidget(summary({ cancelAtPeriodEnd: true }));
    await waitFor(() => expect(screen.getByText('Ends Sep 15, 2026')).toBeInTheDocument());
  });

  it('drops the upgrade CTA on Agency but keeps the date and See limits', async () => {
    renderWidget(summary({ planSlug: 'agency', planName: 'Agency' }));
    await waitFor(() => expect(screen.getByText('Agency plan')).toBeInTheDocument());
    expect(screen.queryByText('Upgrade now')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
    expect(screen.getByText('Renews Sep 15, 2026')).toBeInTheDocument();
    expect(screen.getByText('See limits')).toBeInTheDocument();
  });

  it('still shows the trial countdown while trialing, not the renewal line', async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    renderWidget(summary({ subscriptionStatus: 'trialing', trialEndsAt: soon }), 'Trial');
    await waitFor(() => expect(screen.getByText(/Trial ·/)).toBeInTheDocument());
    expect(screen.getByText('Upgrade now')).toBeInTheDocument();
  });
});

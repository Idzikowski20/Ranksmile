import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import type { PlanSummaryData } from '@/src/infrastructure/billing/planLimits';

const fetchJson = jest.fn();
jest.mock('@/src/infrastructure/http/fetchJson', () => ({
  __esModule: true,
  default: (...args: unknown[]) => fetchJson(...args),
}));

import { SidebarPlanItem } from '../../components/koala/shell/SidebarPlanItem';

function summary(over: Partial<PlanSummaryData>): PlanSummaryData {
  return {
    planSlug: 'growth', planName: 'Growth', billingPeriod: 'monthly',
    subscriptionStatus: 'active', trialEndsAt: null,
    currentPeriodEnd: '2099-09-15T17:01:12.000Z', cancelAtPeriodEnd: false,
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
  it('names the plan and shows the renewal date, with no upgrade CTA on a paid plan', async () => {
    renderWidget(summary({ planSlug: 'growth', planName: 'Growth' }));
    await waitFor(() => expect(screen.getByText('Growth plan')).toBeInTheDocument());
    expect(screen.getByText('Renews Sep 15, 2099')).toBeInTheDocument();
    // Upgrade now is a trial-only nudge — a paying subscriber sees no CTA, any tier.
    expect(screen.queryByText('Upgrade now')).not.toBeInTheDocument();
    expect(screen.getByText('See limits')).toBeInTheDocument();
  });

  it('says Ends when the subscription is set to cancel', async () => {
    renderWidget(summary({ cancelAtPeriodEnd: true }));
    await waitFor(() => expect(screen.getByText('Ends Sep 15, 2099')).toBeInTheDocument());
  });

  it('has no CTA on Agency either, just the date and See limits', async () => {
    renderWidget(summary({ planSlug: 'agency', planName: 'Agency' }));
    await waitFor(() => expect(screen.getByText('Agency plan')).toBeInTheDocument());
    expect(screen.queryByText('Upgrade now')).not.toBeInTheDocument();
    expect(screen.queryByText('Manage')).not.toBeInTheDocument();
    expect(screen.getByText('Renews Sep 15, 2099')).toBeInTheDocument();
    expect(screen.getByText('See limits')).toBeInTheDocument();
  });

  it('still shows the trial countdown while trialing, not the renewal line', async () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    renderWidget(summary({ subscriptionStatus: 'trialing', trialEndsAt: soon }), 'Trial');
    await waitFor(() => expect(screen.getByText(/Trial ·/)).toBeInTheDocument());
    expect(screen.getByText('Upgrade now')).toBeInTheDocument();
  });

  // A cancel whose period already passed still reads `active` until Stripe's webhook
  // lands. The API already treats it as not entitled, so the widget must not present it
  // as a live plan with a past "Ends" date — it falls back to the upgrade card.
  it('does not show the active layout for a lapsed cancel the API no longer entitles', async () => {
    renderWidget(summary({
      subscriptionStatus: 'active',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: new Date(Date.now() - 86_400_000).toISOString(),
    }));
    await waitFor(() => expect(screen.getByText('See limits')).toBeInTheDocument());
    expect(screen.queryByText('Growth plan')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Ends /)).not.toBeInTheDocument();
  });
});

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';

jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}));

import PricingPlansSettings from '../../components/settings/PricingPlansSettings';

function renderPlans() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PricingPlansSettings />
    </QueryClientProvider>,
  );
}

beforeEach(() => fetchMock.resetMocks());

/**
 * The trial CTA is a promise, and it must only be made when the server has said the
 * org is still eligible. `trialEligible !== false` defaulted the answer to YES, so a
 * failed or slow /api/billing/subscription read offered a second free trial to an org
 * that had consumed its one — checkout then silently charged upfront, the worse lie.
 * The server gate (resolveCheckoutMode / assertTrialAllowed) protects the money either
 * way; this protects the words.
 */
describe('plans page trial gate', () => {
  it('offers the trial only after the server confirms eligibility', async () => {
    fetchMock.mockResponse(async (req) => {
      if (req.url.includes('/api/billing/subscription')) {
        return JSON.stringify({ subscription: { trialEligible: true } });
      }
      return JSON.stringify({});
    });

    renderPlans();

    await waitFor(() => expect(screen.getByRole('button', { name: /free trial/i })).toBeInTheDocument());
  });

  it('shows the paid CTA when the subscription read fails', async () => {
    fetchMock.mockResponse(async (req) => {
      if (req.url.includes('/api/billing/subscription')) {
        return { status: 500, body: JSON.stringify({ error: 'boom' }) };
      }
      return JSON.stringify({});
    });

    renderPlans();

    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /free trial/i })).not.toBeInTheDocument();
  });

  it('shows the paid CTA when the org already consumed its trial', async () => {
    fetchMock.mockResponse(async (req) => {
      if (req.url.includes('/api/billing/subscription')) {
        return JSON.stringify({ subscription: { trialEligible: false } });
      }
      return JSON.stringify({});
    });

    renderPlans();

    await waitFor(() => expect(screen.getAllByRole('button').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /free trial/i })).not.toBeInTheDocument();
  });
});

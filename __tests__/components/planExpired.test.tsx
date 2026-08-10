import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from 'react-query';
import { PlanExpired } from '../../components/billing/PlanExpired';

const fetchJson = jest.fn();
jest.mock('../../lib/fetchJson', () => ({
  __esModule: true,
  default: (...args: unknown[]) => fetchJson(...args),
}));

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlanExpired />
    </QueryClientProvider>,
  );
}

beforeEach(() => fetchJson.mockReset());

describe('PlanExpired', () => {
  /**
   * The counts are the whole point of the screen, and they were all zero because
   * every endpoint it read sat behind withOrgPaymentAccess — which 402s for exactly
   * the lapsed account this renders for. One unguarded endpoint now serves them.
   */
  it('reads its counts from the unguarded expired-summary endpoint', async () => {
    fetchJson.mockResolvedValue({
      sites: ['prodetektyw.pl'],
      articles: 13,
      recommendations: 51,
      plan: { slug: 'growth', name: 'Growth', priceMonthly: 59, priceYearly: 590 },
    });

    renderScreen();

    await waitFor(() => expect(screen.getByText('prodetektyw.pl')).toBeInTheDocument());
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByText('51')).toBeInTheDocument();
    // Price line and CTA both name the plan, so assert each rather than a loose match.
    expect(screen.getByText(/Growth\s+— €59\/mo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Growth' })).toBeInTheDocument();
    expect(fetchJson).toHaveBeenCalledWith('/api/billing/expired-summary', expect.anything());
    // It must not fall back to the payment-gated endpoints.
    const urls = fetchJson.mock.calls.map((c) => String(c[0]));
    expect(urls).not.toContain('/api/domains');
    expect(urls.some((u) => u.startsWith('/api/articles'))).toBe(false);
  });

  it('still renders when the account has nothing yet', async () => {
    fetchJson.mockResolvedValue({ sites: [], articles: 0, recommendations: 0, plan: null });

    renderScreen();

    await waitFor(() => expect(screen.getByText('No sites yet.')).toBeInTheDocument());
    expect(screen.getByText('Your plan has expired')).toBeInTheDocument();
  });

  it('offers the changelog', async () => {
    fetchJson.mockResolvedValue({ sites: [], articles: 0, recommendations: 0, plan: null });

    renderScreen();

    const link = await screen.findByRole('link', { name: /See what's new/ });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});

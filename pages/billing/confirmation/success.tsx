import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import OrderConfirmationBody from '../../../components/billing/OrderConfirmationBody';
import Button from '../../../components/koala/primitives/Button';
import type { BillingConfirmation } from '../../../lib/billingConfirmation';
import { fetchBootstrapOrNull } from '../../../lib/fetchBootstrap';
import type { BootstrapData } from '../../../lib/getBootstrap';

const F = 'var(--font-family-primary)';

const CheckoutSuccessPage: NextPage = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = typeof router.query.token === 'string' ? router.query.token.trim() : '';

  const confirmationQ = useQuery(
    ['billing-confirmation', token],
    async () => {
      const q = new URLSearchParams();
      q.set('token', token);
      const res = await fetch(`/api/billing/confirmation?${q.toString()}`);
      const data = await res.json() as { confirmation?: BillingConfirmation; error?: string; code?: string };
      if (!res.ok || !data.confirmation) {
        throw new Error(data.error ?? 'Failed to load confirmation');
      }
      return data.confirmation;
    },
    {
      enabled: router.isReady && Boolean(token),
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: Infinity,
    },
  );

  // Checkout mutates billing entitlement — drop stale BILLING_REQUIRED bootstrap or
  // ApplicationShell will bounce /workspace/new → /plans for ~5 minutes.
  useEffect(() => {
    if (!confirmationQ.isSuccess) return;
    void queryClient.invalidateQueries(['bootstrap']);
  }, [confirmationQ.isSuccess, queryClient]);

  const goAfterCheckout = async () => {
    await queryClient.invalidateQueries(['bootstrap']);
    let boot: BootstrapData | null = null;
    try {
      boot = await queryClient.fetchQuery(['bootstrap'], fetchBootstrapOrNull);
    } catch {
      boot = null;
    }
    const to = boot?.access?.redirect?.redirect
      ?? boot?.redirectTo
      ?? '/';
    await router.push(to);
  };

  const missingToken = router.isReady && !token;

  return (
    <AppShell domains={[]} showAddModal={() => {}} showSettings={() => {}} showSidebar={false} hideMobileNav>
      <Head>
        <title>Order confirmation — Ranksmile</title>
        <meta name="robots" content="noindex" />
      </Head>
      {/* No bg/color-scheme of its own — `html.koala-shell .app-content` already paints
          the themed surface (see the same note on the checkout page). */}
      <div className="relative flex-1 overflow-auto rounded-xl styled-scrollbar">
        <div style={{ color: 'var(--koala-text-primary)', fontFamily: F, padding: '64px 24px 96px', boxSizing: 'border-box' }}>
          {missingToken || confirmationQ.isError ? (
            <div style={{
              maxWidth: 480,
              margin: '80px auto',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
            }}
            >
              <p style={{ margin: 0, color: 'var(--koala-text-secondary)', fontSize: 15, lineHeight: '22px' }}>
                {missingToken
                  ? 'This confirmation page can only be opened from a successful checkout link.'
                  : confirmationQ.error instanceof Error
                    ? confirmationQ.error.message
                    : 'This confirmation link is invalid or has expired.'}
              </p>
              <Button type="button" variant="primary" size="md" onClick={() => { void goAfterCheckout(); }}>
                Continue
              </Button>
            </div>
          ) : confirmationQ.isLoading || !confirmationQ.data ? (
            <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', color: 'var(--koala-text-secondary)', fontSize: 15 }}>
              Confirming your payment…
            </div>
          ) : (
            <OrderConfirmationBody
              data={confirmationQ.data}
              onContinue={() => { void goAfterCheckout(); }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default CheckoutSuccessPage;

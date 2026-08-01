import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useQuery } from 'react-query';
import AppShell from '../../../components/common/AppShell';
import OrderConfirmationBody from '../../../components/billing/OrderConfirmationBody';
import type { BillingConfirmation } from '../../../lib/billingConfirmation';

const F = 'var(--font-family-primary)';

const CheckoutSuccessPage: NextPage = () => {
  const router = useRouter();
  const sessionId = typeof router.query.session_id === 'string' ? router.query.session_id : null;
  const plan = typeof router.query.plan === 'string' ? router.query.plan : null;

  const confirmationQ = useQuery(
    ['billing-confirmation', sessionId, plan],
    async () => {
      const q = new URLSearchParams();
      if (sessionId) q.set('session_id', sessionId);
      if (plan) q.set('plan', plan);
      const res = await fetch(`/api/billing/confirmation?${q.toString()}`);
      if (!res.ok) throw new Error('Failed to load confirmation');
      const data = await res.json() as { confirmation: BillingConfirmation };
      return data.confirmation;
    },
    { enabled: router.isReady, refetchOnWindowFocus: false, retry: 1 },
  );

  return (
    <AppShell domains={[]} showAddModal={() => {}} showSettings={() => {}} showSidebar={false} hideMobileNav>
      <Head>
        <title>Order confirmation — Ranksmile</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="relative flex-1 overflow-auto rounded-xl bg-white-base [color-scheme:light] styled-scrollbar">
        <div style={{ color: '#1a1a1a', fontFamily: F, padding: '64px 24px 96px', boxSizing: 'border-box' }}>
          {confirmationQ.isLoading || !confirmationQ.data ? (
            <div style={{ maxWidth: 480, margin: '80px auto', textAlign: 'center', color: '#575757', fontSize: 15 }}>
              {confirmationQ.isError ? 'Could not load order details.' : 'Confirming your payment…'}
            </div>
          ) : (
            <OrderConfirmationBody
              data={confirmationQ.data}
              onContinue={() => { void router.push('/dashboard'); }}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default CheckoutSuccessPage;

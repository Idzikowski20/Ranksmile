import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AuthPageLayout from '../../../components/auth/AuthPageLayout';
import AuthShell from '../../../components/auth/AuthShell';
import { Card } from '../../../components/koala/product';
import Button from '../../../components/koala/primitives/Button';
import { FeedbackFrame } from '../../../components/koala/feedback';

const AlertIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" stroke="#dc2626" strokeWidth="1.5" />
    <path d="M12 8v5M12 16h.01" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CheckoutFailedPage: NextPage = () => {
  const router = useRouter();

  return (
    <AuthShell>
      <Head>
        <title>Payment failed — Ranksmile</title>
        <meta name="robots" content="noindex" />
      </Head>
      <AuthPageLayout>
        <Card elevated>
          <FeedbackFrame
            icon={<AlertIcon />}
            title="Payment couldn't be completed"
            description="We couldn't process your payment. Update your billing details or choose a plan to try again."
            action={(
              <>
                <Button variant="primary" size="md" onClick={() => router.push('/plans')}>
                  View plans
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => router.push('/settings/billing_subscription?view=plans')}
                >
                  Retry checkout
                </Button>
              </>
            )}
          />
        </Card>
      </AuthPageLayout>
    </AuthShell>
  );
};

export default CheckoutFailedPage;

import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import PricingPlansSettings from '../components/settings/PricingPlansSettings';

const PlansPage: NextPage = () => {
  const router = useRouter();
  return (
    <>
      <Head>
        <title>Pricing &amp; Plans · Ranksmile</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ minHeight: '100dvh', height: '100%', overflowY: 'auto', background: '#f5f5f5', fontFamily: 'var(--font-family-primary)', padding: '48px 24px 80px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <PricingPlansSettings onSkip={() => router.push('/')} />
        </div>
      </div>
    </>
  );
};

export default PlansPage;

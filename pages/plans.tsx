import type { NextPage } from 'next';
import Head from 'next/head';
import PricingPlansSettings from '../components/settings/PricingPlansSettings';

const PlansPage: NextPage = () => (
  <>
    <Head>
      <title>Pricing &amp; Plans · Ranksmile</title>
      <meta name="robots" content="noindex" />
    </Head>
    <div style={{ minHeight: '100dvh', height: '100%', overflowY: 'auto', background: '#f5f5f5', fontFamily: 'var(--font-family-primary)', padding: '48px 24px 80px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <PricingPlansSettings />
      </div>
    </div>
  </>
);

export default PlansPage;

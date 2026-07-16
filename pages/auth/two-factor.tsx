import type { NextPage } from 'next';
import Head from 'next/head';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import TwoFactorForm from '../../components/auth/TwoFactorForm';

const TwoFactor: NextPage = () => (
  <AuthShell>
    <Head>
      <title>Two-factor — SerpBear</title>
    </Head>
    <AuthPageLayout>
      <TwoFactorForm />
    </AuthPageLayout>
  </AuthShell>
);

export default TwoFactor;

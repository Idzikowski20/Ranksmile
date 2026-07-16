import type { NextPage } from 'next';
import Head from 'next/head';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import EmailOtpForm from '../../components/auth/EmailOtpForm';

const EmailOtp: NextPage = () => (
  <AuthShell>
    <Head>
      <title>Email verification — SerpBear</title>
    </Head>
    <AuthPageLayout>
      <EmailOtpForm />
    </AuthPageLayout>
  </AuthShell>
);

export default EmailOtp;

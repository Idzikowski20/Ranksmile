import type { NextPage } from 'next';
import Head from 'next/head';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import ResetPasswordForm from '../../components/auth/ResetPasswordForm';

const ResetPassword: NextPage = () => (
  <AuthShell>
    <Head>
      <title>Reset password — SerpBear</title>
    </Head>
    <AuthPageLayout>
      <ResetPasswordForm />
    </AuthPageLayout>
  </AuthShell>
);

export default ResetPassword;

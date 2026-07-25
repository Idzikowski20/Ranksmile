import type { NextPage } from 'next';
import Head from 'next/head';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';

const ForgotPassword: NextPage = () => (
  <AuthShell>
    <Head>
      <title>Forgot password — Ranksmile</title>
    </Head>
    <AuthPageLayout>
      <ForgotPasswordForm />
    </AuthPageLayout>
  </AuthShell>
);

export default ForgotPassword;

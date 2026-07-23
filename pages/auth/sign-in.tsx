import type { NextPage } from 'next';
import Head from 'next/head';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import EmailSignInForm from '../../components/auth/EmailSignInForm';

const SignIn: NextPage = () => (
  <AuthShell>
    <Head>
      <title>Sign in — Surfy</title>
    </Head>
    <AuthPageLayout>
      <EmailSignInForm />
    </AuthPageLayout>
  </AuthShell>
);

export default SignIn;

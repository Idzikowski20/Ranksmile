import type { NextPage } from 'next';
import Head from 'next/head';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';
import EmailSignUpForm from '../../components/auth/EmailSignUpForm';

const SignUp: NextPage = () => (
  <AuthShell>
    <Head>
      <title>Sign up — Ranksmile</title>
    </Head>
    <AuthPageLayout>
      <EmailSignUpForm />
    </AuthPageLayout>
  </AuthShell>
);

export default SignUp;

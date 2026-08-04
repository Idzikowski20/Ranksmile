import type { NextPage } from 'next';
import Head from 'next/head';
import React, { useEffect } from 'react';
import { signOut } from '../../lib/auth/fetchAuth';
import { authSubtitleStyle, authTitleStyle } from '../../components/auth/authStyles';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';

const SignOut: NextPage = () => {
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await signOut();
      if (!cancelled) {
        window.location.href = '/auth/sign-in';
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthShell>
      <Head>
        <title>Signing out — Ranksmile</title>
      </Head>
      <AuthPageLayout>
        <h1 style={authTitleStyle}>Signing out</h1>
        <p style={authSubtitleStyle}>Please wait…</p>
      </AuthPageLayout>
    </AuthShell>
  );
};

export default SignOut;

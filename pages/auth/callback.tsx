import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useEffect } from 'react';
import { fetchBootstrapOrNull } from '../../lib/fetchBootstrap';
import { authSubtitleStyle, authTitleStyle } from '../../components/auth/authStyles';
import AuthPageLayout from '../../components/auth/AuthPageLayout';
import AuthShell from '../../components/auth/AuthShell';

const AuthCallback: NextPage = () => {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const bootstrap = await fetchBootstrapOrNull();
        if (cancelled) return;
        window.location.href = bootstrap ? '/' : '/auth/sign-in';
      } catch {
        if (!cancelled) window.location.href = '/auth/sign-in';
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <AuthShell>
      <Head>
        <title>SerpBear</title>
      </Head>
      <AuthPageLayout>
        <h1 style={authTitleStyle}>Completing sign in</h1>
        <p style={authSubtitleStyle}>Please wait…</p>
      </AuthPageLayout>
    </AuthShell>
  );
};

export default AuthCallback;

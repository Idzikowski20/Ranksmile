import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { signInEmail } from '../../lib/auth/fetchAuth';
import AuthField from './AuthField';
import {
  authErrorStyle,
  authFooterStyle,
  authLabelStyle,
  authLinkStyle,
  authPrimaryButtonStyle,
  authSubtitleStyle,
  authTitleStyle,
} from './authStyles';

export default function EmailSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const callbackURL = typeof router.query.callbackUrl === 'string'
    ? router.query.callbackUrl
    : '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signInEmail({
      email: email.trim(),
      password,
      callbackURL,
      rememberMe: true,
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    if (result.data.twoFactorRedirect) {
      await router.push('/auth/two-factor');
      return;
    }

    window.location.href = callbackURL;
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 style={authTitleStyle}>Sign In</h1>
      <p style={authSubtitleStyle}>Enter your email below to login to your account</p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}

      <AuthField
        id="sign-in-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={loading}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label htmlFor="sign-in-password" style={authLabelStyle}>Password</label>
        <Link href="/auth/forgot-password" style={authLinkStyle}>
          Forgot your password?
        </Link>
      </div>
      <AuthField
        id="sign-in-password"
        label=""
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        disabled={loading}
      />

      <button
        type="submit"
        disabled={loading}
        style={{
          ...authPrimaryButtonStyle,
          marginTop: 8,
          opacity: loading ? 0.7 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#783AFB'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
      >
        {loading ? 'Logging in…' : 'Login'}
      </button>

      <p style={authFooterStyle}>
        Don&apos;t have an account?
        {' '}
        <Link href="/auth/sign-up" style={{ ...authLinkStyle, color: '#18181B', fontWeight: 600 }}>
          Sign Up
        </Link>
      </p>
    </form>
  );
}

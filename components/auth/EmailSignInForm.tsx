import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { signInEmail, signInSocial } from '../../lib/auth/fetchAuth';
import { Button } from '../core';
import { IconGoogleColor } from './IconGoogleColor';
import AuthField from './AuthField';
import AuthBrandMark from './AuthBrandMark';
import {
  authDividerLineStyle,
  authDividerTextStyle,
  authDividerWrapStyle,
  authErrorStyle,
  authFooterStyle,
  authFullWidthBtnStyle,
  authLabelStyle,
  authLinkStyle,
  authSubtitleStyle,
  authTitleStyle,
} from './authStyles';

export default function EmailSignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const callbackURL = typeof router.query.callbackUrl === 'string'
    ? router.query.callbackUrl
    : '/';

  const absoluteCallback = typeof window !== 'undefined'
    ? new URL(callbackURL, window.location.origin).toString()
    : callbackURL;

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

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await signInSocial({
      provider: 'google',
      callbackURL: absoluteCallback,
      errorCallbackURL: typeof window !== 'undefined'
        ? `${window.location.origin}/auth/sign-in`
        : '/auth/sign-in',
    });

    if (!result.ok) {
      setGoogleLoading(false);
      setError(result.error.message);
      return;
    }

    if (result.data.url) {
      window.location.href = result.data.url;
      return;
    }

    setGoogleLoading(false);
    setError('Google sign-in is not available. Check Neon Auth OAuth settings.');
  };

  const busy = loading || googleLoading;

  return (
    <form onSubmit={handleSubmit}>
      <AuthBrandMark />
      <h1 style={authTitleStyle}>Sign in to Ranksmile</h1>
      <p style={authSubtitleStyle}>Pick up where you left off.</p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}

      <AuthField
        id="sign-in-email"
        label="Email or username"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={busy}
        placeholder="you@work.com"
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <label htmlFor="sign-in-password" style={{ ...authLabelStyle, marginBottom: 0 }}>Password</label>
        <Link
          href="/auth/forgot-password"
          style={authLinkStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#E07D42'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6A6772'; }}
        >
          Forgot password?
        </Link>
      </div>
      <AuthField
        id="sign-in-password"
        label=""
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        disabled={busy}
        placeholder="Enter your password"
        revealable
      />

      <div style={authFullWidthBtnStyle}>
        <Button type="submit" variant="primary" size="md" busy={loading} disabled={busy} style={{ width: '100%' }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </div>

      <div style={authDividerWrapStyle} aria-hidden="true">
        <span style={authDividerLineStyle} />
        <span style={authDividerTextStyle}>Or continue with</span>
        <span style={authDividerLineStyle} />
      </div>

      <Button
        type="button"
        variant="secondary"
        size="md"
        busy={googleLoading}
        disabled={busy}
        onClick={() => { void handleGoogle(); }}
        icon={<IconGoogleColor size={18} />}
        style={{ width: '100%' }}
      >
        {googleLoading ? 'Redirecting…' : 'Continue with Google'}
      </Button>

      <p style={authFooterStyle}>
        New to Ranksmile?
        {' '}
        <Link href="/auth/sign-up" style={{ ...authLinkStyle, color: '#181225', fontWeight: 600 }}>
          Create an account
        </Link>
      </p>
    </form>
  );
}

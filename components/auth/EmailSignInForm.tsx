import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import posthog from 'posthog-js';
import { signInEmail, signInSocial } from '../../lib/auth/fetchAuth';
import Button from '../koala/primitives/Button';
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

/** Koala Login Minimal — Ranksmile naming (Figma Login Dialog / Sign In templates). */
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

    posthog.capture('user_signed_in', { method: 'email' });
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
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}
    >
      <AuthBrandMark />
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 384 }}>
        <h1 style={authTitleStyle}>Welcome Back!</h1>
        <p style={authSubtitleStyle}>Please log in to continue.</p>
      </div>

      {error ? <div style={{ ...authErrorStyle, width: '100%' }} role="alert">{error}</div> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          busy={googleLoading}
          disabled={busy}
          onClick={() => { void handleGoogle(); }}
          icon={<IconGoogleColor size={20} />}
          style={{ width: '100%', borderRadius: 14, boxShadow: '0px 1px 1px rgba(0,0,0,0.04)' }}
        >
          {googleLoading ? 'Redirecting…' : 'Sign in with Google'}
        </Button>

        <div style={authDividerWrapStyle} aria-hidden="true">
          <span style={authDividerLineStyle} />
          <span style={authDividerTextStyle}>Or you can login with</span>
          <span style={authDividerLineStyle} />
        </div>

        <AuthField
          id="sign-in-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={busy}
          placeholder="Enter your email"
          required
        />

        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label htmlFor="sign-in-password" style={{ ...authLabelStyle, marginBottom: 0 }}>Password</label>
            <Link href="/auth/forgot-password" style={authLinkStyle}>
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
            required
          />
        </div>
      </div>

      <div style={{ ...authFullWidthBtnStyle, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <Button type="submit" variant="primary" size="lg" busy={loading} disabled={busy} style={{ width: '100%', borderRadius: 14 }}>
          {loading ? 'Signing in…' : 'Continue'}
        </Button>
        <p style={authFooterStyle}>
          Don&apos;t have an account?
          {' '}
          <Link href="/auth/sign-up" style={{ ...authLinkStyle, textDecoration: 'underline' }}>
            Register now
          </Link>
        </p>
      </div>
    </form>
  );
}

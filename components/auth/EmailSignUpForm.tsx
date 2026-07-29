import Link from 'next/link';
import React, { useState } from 'react';
import posthog from 'posthog-js';
import { signInSocial, signUpEmail } from '../../lib/auth/fetchAuth';
import { Button } from '../core';
import { IconGoogleColor } from './IconGoogleColor';
import AuthField from './AuthField';
import AuthBrandMark from './AuthBrandMark';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import {
  authDividerLineStyle,
  authDividerTextStyle,
  authDividerWrapStyle,
  authErrorStyle,
  authFooterStyle,
  authFullWidthBtnStyle,
  authLinkStyle,
  authSubtitleStyle,
  authTitleStyle,
} from './authStyles';

export default function EmailSignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const absoluteCallback = typeof window !== 'undefined'
    ? new URL('/', window.location.origin).toString()
    : '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signUpEmail({
      name: name.trim(),
      email: email.trim(),
      password,
      callbackURL: '/',
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    posthog.capture('user_signed_up', { method: 'email' });

    window.location.href = '/';
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await signInSocial({
      provider: 'google',
      callbackURL: absoluteCallback,
      errorCallbackURL: typeof window !== 'undefined'
        ? `${window.location.origin}/auth/sign-up`
        : '/auth/sign-up',
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
    setError('Google sign-up is not available. Check Neon Auth OAuth settings.');
  };

  const busy = loading || googleLoading;

  return (
    <form onSubmit={handleSubmit}>
      <AuthBrandMark />
      <h1 style={authTitleStyle}>Create your Ranksmile account</h1>
      <p style={authSubtitleStyle}>Start shipping SEO content faster.</p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}

      <AuthField
        id="sign-up-name"
        label="Name"
        type="text"
        value={name}
        onChange={setName}
        autoComplete="name"
        disabled={busy}
        placeholder="Your name"
      />

      <AuthField
        id="sign-up-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={busy}
        placeholder="you@work.com"
      />

      <PasswordStrengthIndicator
        id="sign-up-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        disabled={busy}
        placeholder="Create a password"
      />

      <div style={authFullWidthBtnStyle}>
        <Button type="submit" variant="primary" size="md" busy={loading} disabled={busy} style={{ width: '100%' }}>
          {loading ? 'Creating account…' : 'Create account'}
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
        Already have an account?
        {' '}
        <Link href="/auth/sign-in" style={{ ...authLinkStyle, color: '#181225', fontWeight: 600 }}>
          Sign in
        </Link>
      </p>
    </form>
  );
}

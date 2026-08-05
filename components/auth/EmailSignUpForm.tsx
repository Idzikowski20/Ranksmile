import Link from 'next/link';
import React, { useState } from 'react';
import { signInSocial, signUpEmail } from '../../lib/auth/fetchAuth';
import Button from '../koala/primitives/Button';
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

/** Koala Register Minimal — Ranksmile naming + password strength (kept). */
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
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}
    >
      <AuthBrandMark />
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 384 }}>
        <h1 style={authTitleStyle}>Create an account</h1>
        <p style={authSubtitleStyle}>Start shipping SEO content with Ranksmile.</p>
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
          {googleLoading ? 'Redirecting…' : 'Sign up with Google'}
        </Button>

        <div style={authDividerWrapStyle} aria-hidden="true">
          <span style={authDividerLineStyle} />
          <span style={authDividerTextStyle}>Or continue with email</span>
          <span style={authDividerLineStyle} />
        </div>

        <AuthField
          id="sign-up-name"
          label="Full Name"
          type="text"
          value={name}
          onChange={setName}
          autoComplete="name"
          disabled={busy}
          placeholder="Enter your full name"
          required
        />

        <AuthField
          id="sign-up-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={busy}
          placeholder="Enter your email"
          required
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
      </div>

      <div style={{ ...authFullWidthBtnStyle, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          busy={loading}
          disabled={busy}
          style={{ width: '100%', borderRadius: 14 }}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
        <p style={authFooterStyle}>
          Have an account already?
          {' '}
          <Link href="/auth/sign-in" style={{ ...authLinkStyle, textDecoration: 'underline' }}>
            Login now
          </Link>
        </p>
      </div>
    </form>
  );
}

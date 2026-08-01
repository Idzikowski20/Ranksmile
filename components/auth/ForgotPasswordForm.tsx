import Link from 'next/link';
import React, { useState } from 'react';
import { requestPasswordReset } from '../../lib/auth/fetchAuth';
import Button from '../koala/primitives/Button';
import AuthBrandMark from './AuthBrandMark';
import AuthField from './AuthField';
import {
  authErrorStyle,
  authFooterStyle,
  authFullWidthBtnStyle,
  authLinkStyle,
  authSubtitleStyle,
  authSuccessStyle,
  authTitleStyle,
} from './authStyles';

function resetRedirectUrl(): string {
  if (typeof window === 'undefined') return '/auth/reset-password';
  return `${window.location.origin}/auth/reset-password`;
}

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const result = await requestPasswordReset({
      email: email.trim(),
      redirectTo: resetRedirectUrl(),
    });

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}
    >
      <AuthBrandMark />
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 384 }}>
        <h1 style={authTitleStyle}>Forgot password?</h1>
        <p style={authSubtitleStyle}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {error ? <div style={{ ...authErrorStyle, width: '100%' }} role="alert">{error}</div> : null}
      {success ? (
        <div style={{ ...authSuccessStyle, width: '100%' }} role="status">
          If an account exists for this email, a reset link has been sent.
        </div>
      ) : null}

      <div style={{ width: '100%' }}>
        <AuthField
          id="forgot-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={loading}
          placeholder="Enter your email"
          required
        />
      </div>

      <div style={{ ...authFullWidthBtnStyle, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <Button type="submit" variant="primary" size="lg" busy={loading} disabled={loading} style={{ width: '100%', borderRadius: 14 }}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
        <p style={authFooterStyle}>
          <Link href="/auth/sign-in" style={{ ...authLinkStyle, textDecoration: 'underline' }}>
            Back to Sign In
          </Link>
        </p>
      </div>
    </form>
  );
}

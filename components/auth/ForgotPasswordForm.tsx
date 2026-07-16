import Link from 'next/link';
import React, { useState } from 'react';
import { requestPasswordReset } from '../../lib/auth/fetchAuth';
import AuthField from './AuthField';
import {
  authErrorStyle,
  authFooterStyle,
  authLinkStyle,
  authPrimaryButtonStyle,
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
    <form onSubmit={handleSubmit}>
      <h1 style={authTitleStyle}>Forgot password</h1>
      <p style={authSubtitleStyle}>
        Enter your email and we&apos;ll send you a reset link
      </p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}
      {success ? (
        <div style={authSuccessStyle} role="status">
          If an account exists for this email, a reset link has been sent.
        </div>
      ) : null}

      <AuthField
        id="forgot-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
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
        {loading ? 'Sending…' : 'Send reset link'}
      </button>

      <p style={authFooterStyle}>
        <Link href="/auth/sign-in" style={{ ...authLinkStyle, color: '#18181B', fontWeight: 600 }}>
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}

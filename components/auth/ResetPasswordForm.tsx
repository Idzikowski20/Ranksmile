import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { resetPassword } from '../../lib/auth/fetchAuth';
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

function tokenFromQuery(query: Record<string, string | string[] | undefined>): string {
  const raw = query.token ?? query.code;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw) && raw[0]) return raw[0];
  return '';
}

export default function ResetPasswordForm() {
  const router = useRouter();
  const token = useMemo(() => tokenFromQuery(router.query), [router.query]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset link is invalid or expired. Request a new one.');
      return;
    }

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    const result = await resetPassword({ newPassword: password, token });

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      window.location.href = '/auth/sign-in';
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 style={authTitleStyle}>Reset password</h1>
      <p style={authSubtitleStyle}>Choose a new password for your account</p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}
      {success ? (
        <div style={authSuccessStyle} role="status">
          Password updated. Redirecting to sign in…
        </div>
      ) : null}

      <AuthField
        id="reset-password"
        label="New password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        disabled={loading || success}
      />

      <AuthField
        id="reset-password-confirm"
        label="Confirm password"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        disabled={loading || success}
      />

      <button
        type="submit"
        disabled={loading || success}
        style={{
          ...authPrimaryButtonStyle,
          marginTop: 8,
          opacity: loading || success ? 0.7 : 1,
          cursor: loading || success ? 'not-allowed' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!loading && !success) e.currentTarget.style.background = '#783AFB';
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
      >
        {loading ? 'Saving…' : 'Reset password'}
      </button>

      <p style={authFooterStyle}>
        <Link href="/auth/sign-in" style={{ ...authLinkStyle, color: '#18181B', fontWeight: 600 }}>
          Back to Sign In
        </Link>
      </p>
    </form>
  );
}

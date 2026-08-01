import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useMemo, useState } from 'react';
import { resetPassword } from '../../lib/auth/fetchAuth';
import Button from '../koala/primitives/Button';
import AuthBrandMark from './AuthBrandMark';
import AuthField from './AuthField';
import PasswordStrengthIndicator from './PasswordStrengthIndicator';
import {
  authErrorStyle,
  authFooterStyle,
  authFullWidthBtnStyle,
  authLinkStyle,
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
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}
    >
      <AuthBrandMark />
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 384 }}>
        <h1 style={authTitleStyle}>Reset password</h1>
        <p style={authSubtitleStyle}>Choose a new password for your account</p>
      </div>

      {error ? <div style={{ ...authErrorStyle, width: '100%' }} role="alert">{error}</div> : null}
      {success ? (
        <div style={{ ...authSuccessStyle, width: '100%' }} role="status">
          Password updated. Redirecting to sign in…
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <PasswordStrengthIndicator
          id="reset-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          disabled={loading || success}
          placeholder="Enter a new password"
        />

        <AuthField
          id="reset-password-confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          disabled={loading || success}
          revealable
          required
        />
      </div>

      <div style={{ ...authFullWidthBtnStyle, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          busy={loading}
          disabled={loading || success}
          style={{ width: '100%', borderRadius: 14 }}
        >
          {loading ? 'Saving…' : 'Reset password'}
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

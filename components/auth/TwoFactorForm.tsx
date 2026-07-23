import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { verifyTwoFactor } from '../../lib/auth/fetchAuth';
import { Button } from '../core';
import AuthField from './AuthField';
import {
  authErrorStyle,
  authFullWidthBtnStyle,
  authLinkStyle,
  authSubtitleStyle,
  authTitleStyle,
} from './authStyles';

export default function TwoFactorForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await verifyTwoFactor({ code: code.trim() });

    setLoading(false);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    window.location.href = '/';
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1 style={authTitleStyle}>Two-factor authentication</h1>
      <p style={authSubtitleStyle}>Enter the code from your authenticator app</p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}

      <AuthField
        id="two-factor-code"
        label="Verification code"
        type="text"
        value={code}
        onChange={setCode}
        autoComplete="one-time-code"
        disabled={loading}
      />

      <div style={authFullWidthBtnStyle}>
        <Button type="submit" variant="primary" size="md" busy={loading} disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </div>

      <p style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => router.push('/auth/sign-in')}
          style={{
            ...authLinkStyle,
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Back to Sign In
        </button>
      </p>
    </form>
  );
}

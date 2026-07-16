import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { verifyTwoFactor } from '../../lib/auth/fetchAuth';
import AuthField from './AuthField';
import {
  authErrorStyle,
  authPrimaryButtonStyle,
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
        {loading ? 'Verifying…' : 'Verify'}
      </button>

      <p style={{ marginTop: 16, textAlign: 'center' }}>
        <button
          type="button"
          onClick={() => router.push('/auth/sign-in')}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#52525C',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Back to Sign In
        </button>
      </p>
    </form>
  );
}

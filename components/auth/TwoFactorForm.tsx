import { useRouter } from 'next/router';
import React, { useState } from 'react';
import { verifyTwoFactor } from '../../lib/auth/fetchAuth';
import Button from '../koala/primitives/Button';
import AuthBrandMark from './AuthBrandMark';
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
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center', width: '100%' }}
    >
      <AuthBrandMark />
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 384 }}>
        <h1 style={authTitleStyle}>Two-factor authentication</h1>
        <p style={authSubtitleStyle}>Enter the code from your authenticator app</p>
      </div>

      {error ? <div style={{ ...authErrorStyle, width: '100%' }} role="alert">{error}</div> : null}

      <div style={{ width: '100%' }}>
        <AuthField
          id="two-factor-code"
          label="Verification code"
          type="text"
          value={code}
          onChange={setCode}
          autoComplete="one-time-code"
          disabled={loading}
          required
        />
      </div>

      <div style={{ ...authFullWidthBtnStyle, display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
        <Button type="submit" variant="primary" size="lg" busy={loading} disabled={loading} style={{ width: '100%', borderRadius: 14 }}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
        <p style={{ margin: 0, textAlign: 'center' }}>
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
              textDecoration: 'underline',
            }}
          >
            Back to Sign In
          </button>
        </p>
      </div>
    </form>
  );
}

import React, { useState } from 'react';
import { verifyEmailOtp } from '../../lib/auth/fetchAuth';
import Button from '../koala/primitives/Button';
import AuthBrandMark from './AuthBrandMark';
import AuthField from './AuthField';
import {
  authErrorStyle,
  authFullWidthBtnStyle,
  authSubtitleStyle,
  authTitleStyle,
} from './authStyles';

export default function EmailOtpForm() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await verifyEmailOtp({
      email: email.trim(),
      otp: otp.trim(),
    });

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
        <h1 style={authTitleStyle}>Email verification</h1>
        <p style={authSubtitleStyle}>Enter the code we sent to your email</p>
      </div>

      {error ? <div style={{ ...authErrorStyle, width: '100%' }} role="alert">{error}</div> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
        <AuthField
          id="email-otp-email"
          label="Email Address"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          disabled={loading}
          required
        />

        <AuthField
          id="email-otp-code"
          label="Verification code"
          type="text"
          value={otp}
          onChange={setOtp}
          autoComplete="one-time-code"
          disabled={loading}
          required
        />
      </div>

      <div style={{ ...authFullWidthBtnStyle, width: '100%' }}>
        <Button type="submit" variant="primary" size="lg" busy={loading} disabled={loading} style={{ width: '100%', borderRadius: 14 }}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </div>
    </form>
  );
}

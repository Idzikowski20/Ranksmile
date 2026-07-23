import React, { useState } from 'react';
import { verifyEmailOtp } from '../../lib/auth/fetchAuth';
import { Button } from '../core';
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
    <form onSubmit={handleSubmit}>
      <h1 style={authTitleStyle}>Email verification</h1>
      <p style={authSubtitleStyle}>Enter the code we sent to your email</p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}

      <AuthField
        id="email-otp-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={loading}
      />

      <AuthField
        id="email-otp-code"
        label="Verification code"
        type="text"
        value={otp}
        onChange={setOtp}
        autoComplete="one-time-code"
        disabled={loading}
      />

      <div style={authFullWidthBtnStyle}>
        <Button type="submit" variant="primary" size="md" busy={loading} disabled={loading} style={{ width: '100%' }}>
          {loading ? 'Verifying…' : 'Verify'}
        </Button>
      </div>
    </form>
  );
}

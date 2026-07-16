import Link from 'next/link';
import React, { useState } from 'react';
import { signUpEmail } from '../../lib/auth/fetchAuth';
import AuthField from './AuthField';
import {
  authErrorStyle,
  authFooterStyle,
  authLinkStyle,
  authPrimaryButtonStyle,
  authSubtitleStyle,
  authTitleStyle,
} from './authStyles';

export default function EmailSignUpForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <form onSubmit={handleSubmit}>
      <h1 style={authTitleStyle}>Sign Up</h1>
      <p style={authSubtitleStyle}>Create your SerpBear account</p>

      {error ? <div style={authErrorStyle} role="alert">{error}</div> : null}

      <AuthField
        id="sign-up-name"
        label="Name"
        type="text"
        value={name}
        onChange={setName}
        autoComplete="name"
        disabled={loading}
      />

      <AuthField
        id="sign-up-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        disabled={loading}
      />

      <AuthField
        id="sign-up-password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
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
        {loading ? 'Creating account…' : 'Sign Up'}
      </button>

      <p style={authFooterStyle}>
        Already have an account?
        {' '}
        <Link href="/auth/sign-in" style={{ ...authLinkStyle, color: '#18181B', fontWeight: 600 }}>
          Sign In
        </Link>
      </p>
    </form>
  );
}

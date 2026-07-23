import React, { useState } from 'react';
import {
  authFieldWrapStyle,
  authInputFocusStyle,
  authInputStyle,
  authLabelStyle,
} from './authStyles';

type AuthFieldProps = {
  id: string;
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** When true, password field gets a show/hide control. */
  revealable?: boolean;
};

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M10.6 10.6a2 2 0 002.8 2.8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M9.9 5.1A10.5 10.5 0 0121 12c-.5 1-1.2 2-2.1 2.9M6.1 6.1C4.5 7.5 3.4 9.2 3 12c1.5 4.5 5.4 7.5 9 7.5 1.4 0 2.8-.3 4.1-.9" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export default function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = true,
  disabled = false,
  placeholder,
  revealable = false,
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword && revealable && revealed ? 'text' : type;

  return (
    <div style={authFieldWrapStyle}>
      {label ? <label htmlFor={id} style={authLabelStyle}>{label}</label> : null}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          style={{
            ...authInputStyle,
            ...(focused ? authInputFocusStyle : {}),
            opacity: disabled ? 0.6 : 1,
            paddingRight: isPassword && revealable ? 42 : 16,
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {isPassword && revealable ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            onClick={() => setRevealed((v) => !v)}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 28,
              height: 28,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              color: '#6A6772',
              cursor: 'pointer',
              borderRadius: 6,
              padding: 0,
            }}
          >
            <EyeIcon open={revealed} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

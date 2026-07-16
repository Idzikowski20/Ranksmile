import React, { useState } from 'react';
import type { CSSProperties } from 'react';
import {
  authFieldWrapStyle,
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
};

const focusRing: CSSProperties = {
  borderColor: '#AA93FD',
  boxShadow: '0 0 0 3px rgba(120, 58, 251, 0.1)',
};

export default function AuthField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required = true,
  disabled = false,
}: AuthFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={authFieldWrapStyle}>
      {label ? <label htmlFor={id} style={authLabelStyle}>{label}</label> : null}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        style={{
          ...authInputStyle,
          ...(focused ? focusRing : {}),
          opacity: disabled ? 0.6 : 1,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

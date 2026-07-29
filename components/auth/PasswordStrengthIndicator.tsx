import React, { useEffect, useState } from 'react';
import {
  authFieldWrapStyle,
  authInputFocusStyle,
  authInputStyle,
  authLabelStyle,
} from './authStyles';
import {
  calculateStrength,
  PASSWORD_REQUIREMENTS,
  PASSWORD_STRENGTH_MAX_SCORE,
  strengthBarColors,
  strengthLabelColors,
  strengthLabels,
  type StrengthLevel,
} from './passwordStrength';

export type { StrengthLevel };

export type PasswordStrengthIndicatorProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  showScore?: boolean;
  showScoreNumber?: boolean;
  showVisibilityToggle?: boolean;
  showRequirements?: boolean;
  onStrengthChange?: (strength: StrengthLevel) => void;
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

function StatusIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function ReqIcon({ met }: { met: boolean }) {
  if (met) {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 12l5 5L20 7" stroke="#008900" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="7" stroke="#C0BEC6" strokeWidth="1.75" />
    </svg>
  );
}

export default function PasswordStrengthIndicator({
  id,
  value,
  onChange,
  label = 'Password',
  placeholder = 'Enter your password',
  autoComplete = 'new-password',
  required = true,
  disabled = false,
  showScore = true,
  showScoreNumber = true,
  showVisibilityToggle = true,
  showRequirements = true,
  onStrengthChange,
}: PasswordStrengthIndicatorProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const { score, level, checks } = calculateStrength(value);
  const filledSegments = value ? Math.min(Math.ceil(score / 1.5), 4) : 0;
  const scoreOutOfTen = Math.floor((score / PASSWORD_STRENGTH_MAX_SCORE) * 10);
  const statusOk = level !== 'weak' && level !== 'empty';

  useEffect(() => {
    onStrengthChange?.(level);
  }, [level, onStrengthChange]);

  return (
    <div style={authFieldWrapStyle}>
      {label ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <label htmlFor={id} style={{ ...authLabelStyle, marginBottom: 0 }}>{label}</label>
          {showScoreNumber ? (
            <span style={{ fontSize: 12, color: '#6A6772', fontWeight: 500 }}>
              {scoreOutOfTen}/10
            </span>
          ) : null}
        </div>
      ) : null}

      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={showVisibilityToggle && revealed ? 'text' : 'password'}
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
            paddingRight: showVisibilityToggle ? (value ? 72 : 42) : (value ? 42 : 16),
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />

        {value ? (
          <div
            style={{
              position: 'absolute',
              right: showVisibilityToggle ? 40 : 10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 22,
              height: 22,
              borderRadius: '50%',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: strengthBarColors[level === 'empty' ? 'weak' : level],
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <StatusIcon ok={statusOk} />
          </div>
        ) : null}

        {showVisibilityToggle ? (
          <button
            type="button"
            tabIndex={-1}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            onClick={() => setRevealed((v) => !v)}
            disabled={disabled}
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
              cursor: disabled ? 'default' : 'pointer',
              borderRadius: 6,
              padding: 0,
            }}
          >
            <EyeIcon open={revealed} />
          </button>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 3,
          marginTop: 8,
          height: 6,
        }}
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={filledSegments}
        aria-valuetext={strengthLabels[level]}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: '100%',
              borderRadius: 999,
              background: i < filledSegments ? strengthBarColors[level] : '#E6E6E9',
              transition: 'background 200ms cubic-bezier(0.72, 0, 0.16, 1)',
            }}
          />
        ))}
      </div>

      {showScore && level !== 'empty' ? (
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 12,
            fontWeight: 500,
            color: strengthLabelColors[level],
          }}
        >
          {strengthLabels[level]}
        </p>
      ) : null}

      {showRequirements ? (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#6A6772' }}>
            Password requirements:
          </p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 6 }}>
            {PASSWORD_REQUIREMENTS.map((req) => {
              const met = checks[req.key];
              return (
                <li
                  key={req.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    color: met ? '#008900' : '#6A6772',
                    lineHeight: 1.35,
                  }}
                >
                  <ReqIcon met={met} />
                  {req.label}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

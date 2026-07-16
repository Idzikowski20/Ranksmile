import type { CSSProperties } from 'react';

export const AUTH_FONT = 'var(--font-family-primary)';

export const authPageStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#09090b',
  padding: 24,
  fontFamily: AUTH_FONT,
};

export const authCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  background: '#FFFFFF',
  border: '1px solid #F4F4F5',
  borderRadius: 12,
  padding: 32,
  boxSizing: 'border-box',
};

export const authTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 600,
  color: '#18181B',
  textAlign: 'center',
};

export const authSubtitleStyle: CSSProperties = {
  margin: '8px 0 24px',
  fontSize: 14,
  color: '#52525C',
  textAlign: 'center',
  lineHeight: 1.5,
};

export const authLabelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 500,
  color: '#18181B',
};

export const authInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  fontSize: 14,
  fontFamily: AUTH_FONT,
  color: '#18181B',
  background: '#FFFFFF',
  border: '1px solid #D4D4D8',
  borderRadius: 8,
  outline: 'none',
  transition: 'border-color 150ms ease, box-shadow 150ms ease',
};

export const authFieldWrapStyle: CSSProperties = {
  marginBottom: 16,
};

export const authErrorStyle: CSSProperties = {
  marginBottom: 16,
  padding: '10px 12px',
  fontSize: 13,
  color: '#FF6F77',
  background: 'rgba(255, 111, 119, 0.08)',
  borderRadius: 8,
  lineHeight: 1.4,
};

export const authSuccessStyle: CSSProperties = {
  marginBottom: 16,
  padding: '10px 12px',
  fontSize: 13,
  color: '#1AB25E',
  background: 'rgba(26, 178, 94, 0.08)',
  borderRadius: 8,
  lineHeight: 1.4,
};

export const authPrimaryButtonStyle: CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  fontSize: 14,
  fontWeight: 600,
  fontFamily: AUTH_FONT,
  color: '#FFFFFF',
  background: '#2F2F34',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background 150ms ease',
};

export const authLinkStyle: CSSProperties = {
  color: '#52525C',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'color 150ms ease',
};

export const authFooterStyle: CSSProperties = {
  marginTop: 24,
  textAlign: 'center',
  fontSize: 14,
  color: '#52525C',
};

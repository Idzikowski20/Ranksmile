import type { CSSProperties } from 'react';

export const AUTH_FONT = 'var(--font-family-primary)';

/** Koala Product Template — centered minimal light (Sign In `3779:205052` / Login Minimal). */
export const AUTH_SHELL_BG = '#ffffff';

export const authPageStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: AUTH_SHELL_BG,
  fontFamily: AUTH_FONT,
  overflow: 'auto',
};

export const authGradientImageStyle: CSSProperties = {
  display: 'none',
};

export const authNoiseStyle: CSSProperties = {
  display: 'none',
};

export const authTopBarStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  padding: '20px 28px',
  flexShrink: 0,
};

export const authMainStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 16px',
};

export const authCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  background: '#FFFFFF',
  border: 'none',
  borderRadius: 16,
  padding: '0',
  boxSizing: 'border-box',
  boxShadow: 'none',
};

export const authBottomBarStyle: CSSProperties = {
  display: 'none',
};

export const authTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 700,
  letterSpacing: '-1px',
  lineHeight: '30px',
  color: '#1a1a1a',
  textAlign: 'center',
};

export const authSubtitleStyle: CSSProperties = {
  margin: '4px 0 0',
  fontSize: 16,
  color: '#575757',
  textAlign: 'center',
  lineHeight: '24px',
  letterSpacing: '-0.25px',
};

export const authLabelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 8,
  fontSize: 14,
  fontWeight: 500,
  color: '#1a1a1a',
  letterSpacing: '-0.4px',
};

export const authInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 40,
  minHeight: 40,
  padding: '8px 12px',
  fontSize: 14,
  lineHeight: '20px',
  fontFamily: AUTH_FONT,
  fontWeight: 400,
  color: '#1a1a1a',
  background: '#FFFFFF',
  border: '1px solid #e5e5e5',
  borderRadius: 14,
  boxShadow: '0px 1px 2px rgba(0,0,0,0.04)',
  outline: 'none',
  letterSpacing: '-0.4px',
  transition: 'border-color 120ms ease, box-shadow 120ms ease',
};

export const authInputFocusStyle: CSSProperties = {
  borderColor: '#F84416',
  boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 4px #F84416',
};

export const authFieldWrapStyle: CSSProperties = {
  marginBottom: 16,
  width: '100%',
};

export const authErrorStyle: CSSProperties = {
  marginBottom: 16,
  padding: '10px 12px',
  fontSize: 13,
  color: '#dc2626',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 12,
  lineHeight: 1.4,
};

export const authSuccessStyle: CSSProperties = {
  marginBottom: 16,
  padding: '10px 12px',
  fontSize: 13,
  color: '#15803d',
  background: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: 12,
  lineHeight: 1.4,
};

export const authDividerWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  margin: '0',
  width: '100%',
};

export const authDividerLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: '#e5e5e5',
};

export const authDividerTextStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: '#575757',
  whiteSpace: 'nowrap',
  letterSpacing: '-0.4px',
};

export const authLinkStyle: CSSProperties = {
  color: '#F84416',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
  letterSpacing: '-0.25px',
  transition: 'color 150ms ease',
};

export const authFooterStyle: CSSProperties = {
  marginTop: 12,
  textAlign: 'center',
  fontSize: 14,
  color: '#575757',
  letterSpacing: '-0.4px',
};

export const authFullWidthBtnStyle: CSSProperties = {
  width: '100%',
};

export const authPillLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '8px 14px',
  borderRadius: 12,
  border: '1px solid #e5e5e5',
  background: '#FFFFFF',
  color: '#1a1a1a',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  fontFamily: AUTH_FONT,
};

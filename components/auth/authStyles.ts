import type { CSSProperties } from 'react';

export const AUTH_FONT = 'var(--font-family-primary)';

/** Soft mesh stage base — matches auth-mesh.png (blue → lavender). */
export const AUTH_SHELL_BG = '#C5D4F0';

export const authPageStyle: CSSProperties = {
  position: 'relative',
  flex: 1,
  width: '100%',
  height: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  background: AUTH_SHELL_BG,
  fontFamily: AUTH_FONT,
  overflow: 'hidden',
  borderRadius: 12,
};

/**
 * Full-bleed mesh gradient plane (auth-mesh.png).
 * Covers the stage edge-to-edge; slight overscale avoids letterboxing on wide screens.
 */
export const authGradientImageStyle: CSSProperties = {
  position: 'absolute',
  zIndex: 0,
  inset: 0,
  width: '100%',
  height: '100%',
  maxWidth: 'none',
  pointerEvents: 'none',
  userSelect: 'none',
  objectFit: 'cover',
  objectPosition: 'center center',
};

/** Film grain — Relume `noise.webp` tile @ 250px, mix-blend overlay. */
export const authNoiseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 1,
  mixBlendMode: 'overlay',
  backgroundImage: 'url(/textures/noise.webp)',
  backgroundRepeat: 'repeat',
  backgroundPosition: '0 0',
  backgroundSize: '250px',
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
  padding: '16px 16px 40px',
};

/** Sentry panel card — white surface + frosted white rim against mesh. */
export const authCardStyle: CSSProperties = {
  width: '100%',
  maxWidth: 400,
  background: '#FFFFFF',
  border: '1px solid rgba(255, 255, 255, 0.95)',
  borderRadius: 16,
  padding: '32px 28px 28px',
  boxSizing: 'border-box',
  /* Crisp inner edge + thick semi-transparent white rim (no blur) + soft lift */
  boxShadow: [
    '0 0 0 1px rgba(255, 255, 255, 0.9)',
    '0 0 0 8px rgba(255, 255, 255, 0.35)',
    '0 12px 40px rgba(37, 99, 235, 0.10)',
    '0 4px 16px rgba(24, 18, 37, 0.06)',
  ].join(', '),
};

export const authBottomBarStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  textAlign: 'center',
  padding: '0 24px 32px',
  fontSize: 13,
  lineHeight: 1.45,
  color: 'rgba(24, 18, 37, 0.55)',
  flexShrink: 0,
};

export const authTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: '#181225',
  textAlign: 'center',
};

export const authSubtitleStyle: CSSProperties = {
  margin: '8px 0 24px',
  fontSize: 14,
  color: '#6A6772',
  textAlign: 'center',
  lineHeight: 1.45,
};

export const authLabelStyle: CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
  color: '#181225',
};

/** Sentry input: white surface, radius 8px. */
export const authInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: 36,
  minHeight: 36,
  padding: '0 16px',
  fontSize: 14,
  lineHeight: '16px',
  fontFamily: AUTH_FONT,
  fontWeight: 400,
  color: '#302E36',
  background: '#FFFFFF',
  border: '1px solid #dbded4',
  borderRadius: 8,
  boxShadow: 'none',
  outline: 'none',
  transition: 'border-color 120ms cubic-bezier(0.72, 0, 0.16, 1), box-shadow 120ms cubic-bezier(0.72, 0, 0.16, 1)',
};

export const authInputFocusStyle: CSSProperties = {
  borderColor: '#F29964',
  boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 4px #F29964',
};

export const authFieldWrapStyle: CSSProperties = {
  marginBottom: 16,
};

export const authErrorStyle: CSSProperties = {
  marginBottom: 16,
  padding: '10px 12px',
  fontSize: 13,
  color: '#D92D20',
  background: 'rgba(217, 45, 32, 0.06)',
  border: '1px solid rgba(217, 45, 32, 0.18)',
  borderRadius: 8,
  lineHeight: 1.4,
};

export const authSuccessStyle: CSSProperties = {
  marginBottom: 16,
  padding: '10px 12px',
  fontSize: 13,
  color: '#008900',
  background: 'rgba(0, 137, 0, 0.06)',
  border: '1px solid rgba(0, 137, 0, 0.16)',
  borderRadius: 8,
  lineHeight: 1.4,
};

export const authDividerWrapStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  margin: '20px 0 16px',
};

export const authDividerLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: '#dbded4',
};

export const authDividerTextStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: '#878490',
  whiteSpace: 'nowrap',
};

export const authLinkStyle: CSSProperties = {
  color: '#6A6772',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  transition: 'color 150ms ease',
};

export const authFooterStyle: CSSProperties = {
  marginTop: 24,
  textAlign: 'center',
  fontSize: 14,
  color: '#6A6772',
};

export const authFullWidthBtnStyle: CSSProperties = {
  width: '100%',
  marginTop: 8,
};

export const authPillLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '8px 14px',
  borderRadius: 8,
  border: '1px solid rgba(24, 18, 37, 0.12)',
  background: 'rgba(255, 255, 255, 0.55)',
  color: '#302E36',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  fontFamily: AUTH_FONT,
  transition: 'background 150ms ease, border-color 150ms ease',
};

import React, { type ReactNode } from 'react';
import {
  authBottomBarStyle,
  authCardStyle,
  authGradientImageStyle,
  authMainStyle,
  authNoiseStyle,
  authPageStyle,
} from './authStyles';

type AuthPageLayoutProps = {
  children: ReactNode;
  /** Optional top-right action. Hidden by default on login. */
  topAction?: ReactNode | null;
  bottomText?: string;
};

export default function AuthPageLayout({
  children,
  topAction = null,
  bottomText = 'Joining product teams shipping SEO content faster with Surfy',
}: AuthPageLayoutProps) {
  return (
    <div style={authPageStyle}>
      {/* Relume stack: base #222 → oversized gradient SVG → noise overlay */}
      <img
        src="/textures/gradient.svg"
        alt=""
        aria-hidden="true"
        style={authGradientImageStyle}
        draggable={false}
      />
      <div style={authNoiseStyle} aria-hidden="true" />

      {topAction ? (
        <header style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'flex-end', padding: '20px 28px' }}>
          {topAction}
        </header>
      ) : null}

      <main style={authMainStyle}>
        <div style={authCardStyle}>{children}</div>
      </main>

      {bottomText ? <p style={authBottomBarStyle}>{bottomText}</p> : null}
    </div>
  );
}

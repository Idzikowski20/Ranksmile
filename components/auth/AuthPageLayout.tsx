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
  bottomText = 'Joining product teams shipping SEO content faster with Ranksmile',
}: AuthPageLayoutProps) {
  return (
    <div style={authPageStyle}>
      {/* Mesh gradient stage */}
      <img
        src="/textures/auth-mesh.png"
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

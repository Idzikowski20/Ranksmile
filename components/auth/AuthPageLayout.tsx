import React, { type ReactNode } from 'react';
import {
  authBottomBarStyle,
  authCardStyle,
  authMainStyle,
  authPageStyle,
} from './authStyles';

type AuthPageLayoutProps = {
  children: ReactNode;
  topAction?: ReactNode | null;
  bottomText?: string;
};

/** Koala centered minimal auth stage (no mesh — Product Template Sign In). */
export default function AuthPageLayout({
  children,
  topAction = null,
  bottomText,
}: AuthPageLayoutProps) {
  return (
    <div className="auth-page" style={authPageStyle}>
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

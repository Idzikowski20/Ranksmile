import React, { type ReactNode } from 'react';
import { authCardStyle, authPageStyle } from './authStyles';

type AuthPageLayoutProps = {
  children: ReactNode;
};

export default function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div style={authPageStyle}>
      <div style={authCardStyle}>{children}</div>
    </div>
  );
}

import React from 'react';
import '@neondatabase/auth-ui/css';
// @ts-ignore — subpath export; declared in types.d.ts
import { NeonAuthUIProvider } from '@neondatabase/auth/react';
import { authClient } from '../../lib/auth/client';

type AuthShellProps = {
  children: React.ReactNode;
};

/** Neon Auth UI — only on /auth/* routes (not in global _app). */
export default function AuthShell({ children }: AuthShellProps) {
  return (
    <NeonAuthUIProvider authClient={authClient} redirectTo="/" basePath="/auth">
      {children}
    </NeonAuthUIProvider>
  );
}

import React from 'react';
import AuthStaticShell from './AuthStaticShell';

type AuthShellProps = {
  children: React.ReactNode;
};

/**
 * Auth layout wrapper — static dashboard chrome preview around auth pages.
 * Intentionally no Neon Auth UI (Zod crash on Next 12 production bundles).
 */
export default function AuthShell({ children }: AuthShellProps) {
  return <AuthStaticShell>{children}</AuthStaticShell>;
}

import React from 'react';

type AuthShellProps = {
  children: React.ReactNode;
};

/**
 * Auth layout wrapper — Koala Product Template centered minimal (no dashboard chrome preview).
 */
export default function AuthShell({ children }: AuthShellProps) {
  return <>{children}</>;
}

import React from 'react';

type AuthShellProps = {
  children: React.ReactNode;
};

/** Auth layout wrapper — intentionally no Neon Auth UI (Zod crash on Next 12 production bundles). */
export default function AuthShell({ children }: AuthShellProps) {
  return <>{children}</>;
}

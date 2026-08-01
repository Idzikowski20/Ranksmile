import React from 'react';
import Loader from './Loader';

/** Full-screen bootstrap loader — no AppShell so we do not pull SentryNav/auth on "/". */
const AppLoading = ({
  title,
  subtitle = 'Please wait while we prepare everything for you',
  /** @deprecated Prefer `title` — kept for older call sites. */
  message,
}: {
  title?: string;
  subtitle?: string;
  message?: string;
}) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#f3f4f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-family-primary)',
    }}
  >
    <Loader title={message ?? title} subtitle={subtitle} size="md" />
  </div>
);

export default AppLoading;

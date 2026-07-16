import React from 'react';
import EditorLoading from '../articles/EditorLoading';

/** Full-screen bootstrap loader — no AppShell so we do not pull SentryNav/auth on "/". */
const AppLoading = ({
  message = 'Please wait a moment while we are loading the page',
}: {
  message?: string;
}) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: '#f8f9ff',
      display: 'flex',
      fontFamily: 'var(--font-family-primary)',
    }}
  >
    <EditorLoading message={message} />
  </div>
);

export default AppLoading;

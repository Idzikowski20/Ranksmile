import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toaster } from 'react-hot-toast';

/**
 * Portaled to document.body so toasts escape the app height chain
 * (#__next height:100%, body overflow:hidden, .app-shell-body overflow:hidden).
 * Styling: `.app-toast` + Koala semantic CSS vars (see globals.css).
 */
const AppToaster = () => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <Toaster
      position="bottom-right"
      containerClassName="react_toaster"
      containerStyle={{
        bottom: 'var(--toast-inset-bottom, 16px)',
        right: 'var(--toast-inset-right, 16px)',
      }}
      toastOptions={{
        className: 'app-toast',
        style: {
          background: 'var(--koala-card-bg)',
          color: 'var(--koala-text-primary)',
          border: '1px solid var(--koala-card-border)',
          borderRadius: 16,
          fontFamily: 'var(--font-family-primary)',
        },
        success: {
          className: 'app-toast',
          iconTheme: {
            primary: 'var(--koala-status-success)',
            secondary: 'var(--koala-card-bg)',
          },
        },
        error: {
          className: 'app-toast',
          iconTheme: {
            primary: 'var(--koala-status-danger)',
            secondary: 'var(--koala-card-bg)',
          },
        },
      }}
    />,
    document.body,
  );
};

export default AppToaster;

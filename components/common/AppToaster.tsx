import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Toaster } from 'react-hot-toast';

/**
 * Portaled to document.body so toasts escape the app height chain
 * (#__next height:100%, body overflow:hidden, .app-shell-body overflow:hidden).
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
        success: {
          className: 'app-toast',
          iconTheme: { primary: '#37E278', secondary: '#252525' },
        },
        error: {
          className: 'app-toast',
          iconTheme: { primary: '#FF6F77', secondary: '#252525' },
        },
      }}
    />,
    document.body,
  );
};

export default AppToaster;

import React from 'react';
import { Toaster } from 'react-hot-toast';

const AppToaster = () => (
  <Toaster
    position="bottom-right"
    containerClassName="react_toaster"
    toastOptions={{
      style: {
        background: '#18181B',
        color: '#fff',
        border: 'none',
        borderRadius: 8,
        padding: 12,
        maxWidth: 360,
        fontSize: 14,
        fontWeight: 400,
        lineHeight: '20px',
        fontFamily: 'var(--font-family-primary)',
        boxShadow: '0px 8px 16px 0px rgba(24,26,34,0.04), 0px 2px 8px 0px rgba(24,26,34,0.02), 0px 1px 2px 0px rgba(24,26,34,0.06)',
      },
      success: { iconTheme: { primary: '#37E278', secondary: '#18181B' } },
      error: { iconTheme: { primary: '#FF6F77', secondary: '#18181B' } },
    }}
  />
);

export default AppToaster;

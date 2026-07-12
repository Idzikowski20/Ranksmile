import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, type Transition } from 'motion/react';
import styled from '@emotion/styled';
import type { SentryTheme } from '../theme';

type ToastType = 'loading' | 'success' | 'error' | 'undo' | '';

interface ToastIndicator {
  message: string;
  type?: ToastType;
  options?: { undo?: () => void };
  id?: string | number;
}

interface ToastProps {
  indicator: ToastIndicator;
  onDismiss: () => void;
}

const Container = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: '#18181B'; /* overridden by variant */
  border-radius: 8px;
  box-shadow: 0px 8px 24px rgba(0,0,0,0.15);
  max-width: 360px;
  font-size: 14px;
  line-height: 1.4;
`;

const Outer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 10001;
`;

const iconByType: Record<string, React.ReactNode> = {
  success: <svg width="16" height="16" viewBox="0 0 16 16" fill="#1AB25E"><path fillRule="evenodd" d="M13.36 4.5a.75.75 0 0 1 .14 1.05l-7 9a.75.75 0 0 1-1.11.07l-3.5-3.5a.75.75 0 0 1 0-1.06l.08-.08a.75.75 0 0 1 .98 0L5.5 12.5l6.3-8.1a.75.75 0 0 1 1.05-.14l.01.01z" clipRule="evenodd" /></svg>,
  error: <svg width="16" height="16" viewBox="0 0 16 16" fill="#FF6F77"><path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5z" /></svg>,
  loading: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#9F9FA9" strokeWidth="2" strokeDasharray="28" strokeLinecap="round" style={{ transformOrigin: 'center', animation: 'spin 1s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </svg>
  ),
};

const springTransition: Transition = { type: 'spring', stiffness: 450, damping: 25 };

export function Toast({ indicator, onDismiss }: ToastProps) {
  const type = indicator.type || '';
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (type !== 'loading') {
      const t = setTimeout(() => { setVisible(false); setTimeout(onDismiss, 300); }, 4000);
      return () => clearTimeout(t);
    }
  }, [type, onDismiss]);

  const bgMap: Record<string, string> = {
    success: '#1A332A',
    error: '#331B1D',
    '': '#18181B',
    loading: '#18181B',
    undo: '#18181B',
  };

  return (
    <AnimatePresence>
      {visible && (
        <Outer>
          <Container
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={springTransition}
            style={{ background: bgMap[type] || bgMap[''], color: '#FFFFFF', fontFamily: 'var(--font-family-primary)' }}
          >
            {iconByType[type]}
            <span style={{ flex: 1 }}>{indicator.message}</span>
            {indicator.options?.undo && (
              <button
                onClick={() => { indicator.options!.undo!(); onDismiss(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#783AFB',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  padding: 0,
                  fontFamily: 'inherit',
                }}
              >
                Undo
              </button>
            )}
          </Container>
        </Outer>
      )}
    </AnimatePresence>
  );
}

export default Toast;

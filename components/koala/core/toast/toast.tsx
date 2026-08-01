import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, type Transition } from 'motion/react';
import styled from '@emotion/styled';
import { semantic } from '../../tokens/semantic';
import { radius, shadow } from '../../tokens/effects';
import { zIndex } from '../../tokens/zIndex';

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
  position: relative;
  overflow: hidden;
  padding: 12px 14px;
  background: ${semantic.card.bg};
  border: 1px solid ${semantic.card.border};
  border-radius: ${radius.card.default};
  box-shadow: ${shadow.lg};
  max-width: 360px;
  font-size: 14px;
  line-height: 1.4;
  color: ${semantic.text.primary};
  font-family: var(--font-family-primary);
`;

const Outer = styled.div`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: ${zIndex.toast};
`;

const iconByType: Record<string, React.ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--koala-status-success)" aria-hidden="true">
      <path fillRule="evenodd" d="M13.36 4.5a.75.75 0 0 1 .14 1.05l-7 9a.75.75 0 0 1-1.11.07l-3.5-3.5a.75.75 0 0 1 0-1.06l.08-.08a.75.75 0 0 1 .98 0L5.5 12.5l6.3-8.1a.75.75 0 0 1 1.05-.14l.01.01z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--koala-status-danger)" aria-hidden="true">
      <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5z" />
    </svg>
  ),
  loading: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="var(--koala-text-tertiary)" strokeWidth="2" strokeDasharray="28" strokeLinecap="round" style={{ transformOrigin: 'center', animation: 'spin 1s linear infinite' }} />
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

  return (
    <AnimatePresence>
      {visible && (
        <Outer>
          <Container
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={springTransition}
          >
            {iconByType[type]}
            <span style={{ flex: 1 }}>{indicator.message}</span>
            {indicator.options?.undo && (
              <button
                type="button"
                onClick={() => { indicator.options!.undo!(); onDismiss(); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--koala-text-brand)',
                  cursor: 'var(--koala-cursor-pointing)',
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

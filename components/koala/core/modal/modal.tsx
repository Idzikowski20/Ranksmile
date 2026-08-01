import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';

interface ModalProps {
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  closeOnOverlayClick?: boolean;
  className?: string;
}

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const growOut = keyframes`
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.4);
  animation: ${fadeIn} 160ms cubic-bezier(0.24, 1, 0.32, 1);
`;

const Dialog = styled.div<{ $width: number }>(({ $width }) => ({
  background: 'var(--koala-bg-primary)',
  borderRadius: 16,
  width: $width,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: 'calc(100vh - 64px)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: 'var(--shadow-2)',
  animation: `${growOut} 240ms cubic-bezier(0.24, 1, 0.32, 1)`,
  transformOrigin: 'center',
  fontFamily: 'var(--font-family-primary)',
  color: 'var(--koala-text-primary)',
  overflow: 'hidden',
}));

export function ModalHeader({ title, onClose, closeButton }: { title?: string; onClose?: () => void; closeButton?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '24px 24px 16px', borderBottom: '1px solid var(--koala-border-primary)',
    }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 500, color: 'var(--koala-text-primary)', lineHeight: 1.1 }}>{title}</h2>
      {(closeButton && onClose) && <CloseButton onClick={onClose} />}
    </div>
  );
}

export function ModalBody({ children }: { children: React.ReactNode }) {
  return <section style={{ fontSize: 14, padding: '16px 24px', overflow: 'auto', flex: 1, color: 'var(--koala-text-primary)', minHeight: 0 }}>{children}</section>;
}

export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <footer style={{ borderTop: '1px solid var(--koala-border-primary)', display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', gap: 8, flexShrink: 0 }}>{children}</footer>;
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Close modal"
      style={{ display: 'inline-flex', padding: 6, borderRadius: 5, border: '1px solid var(--koala-border-primary)', background: 'var(--koala-bg-primary)', color: 'var(--koala-text-secondary)', cursor: 'var(--koala-cursor-pointing)', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function Modal({ title, onClose, children, width = 680, closeOnOverlayClick = true, className }: ModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCloseRef.current();
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [handleKeyDown]);

  return createPortal(
    <Overlay onClick={closeOnOverlayClick ? onClose : undefined}>
      <Dialog $width={width} className={className} onClick={(e) => e.stopPropagation()}>
        {title && <ModalHeader title={title} onClose={onClose} closeButton />}
        {children}
      </Dialog>
    </Overlay>,
    document.body
  );
}

export default Modal;

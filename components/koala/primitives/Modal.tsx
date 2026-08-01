import React, { useEffect } from 'react';
import styled from '@emotion/styled';
import { ShellPortal, overlayZ } from '../overlay/ShellPortal';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';
import { shadow } from '../tokens/effects';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(26, 26, 26, 0.45);
  z-index: ${overlayZ.modal};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
`;

const Panel = styled.div`
  background: ${semantic.card.bg};
  border: 1px solid ${semantic.card.border};
  border-radius: ${semantic.card.radius};
  box-shadow: ${shadow.lg};
  width: 100%;
  max-width: 480px;
  max-height: min(90vh, 720px);
  overflow: auto;
  font-family: ${typeface.body};
`;

const Header = styled.div`
  padding: 20px 24px 0;
  font-size: 18px;
  font-weight: 700;
  color: ${semantic.text.primary};
  letter-spacing: -0.5px;
`;

const Body = styled.div`
  padding: 16px 24px 24px;
  color: ${semantic.text.secondary};
  font-size: 14px;
  line-height: 20px;
`;

const Footer = styled.div`
  padding: 0 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
`;

export function ModalHeader({ children }: { children: React.ReactNode }) {
  return <Header>{children}</Header>;
}
export function ModalBody({ children }: { children: React.ReactNode }) {
  return <Body>{children}</Body>;
}
export function ModalFooter({ children }: { children: React.ReactNode }) {
  return <Footer>{children}</Footer>;
}

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  'aria-label'?: string;
}

/**
 * Modal stack rule: only one Dialog at a time.
 * Allowed: Dialog → Drawer → Popover → Toast. Never Dialog → Dialog.
 */
export default function Modal({ open, onClose, children, 'aria-label': ariaLabel }: ModalProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <ShellPortal>
      <Overlay role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <Panel role="dialog" aria-modal="true" aria-label={ariaLabel} onClick={(e) => e.stopPropagation()}>
          {children}
        </Panel>
      </Overlay>
    </ShellPortal>
  );
}

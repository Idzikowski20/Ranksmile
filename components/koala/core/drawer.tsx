import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Button from './button/button';

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  ariaLabel?: string;
  position?: 'left' | 'right';
  className?: string;
};

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export function Drawer({
  open,
  onClose,
  title,
  children,
  ariaLabel = 'Drawer',
  position = 'right',
  className = '',
}: DrawerProps) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={`koala-drawer-root ${className}`} role="presentation">
      <button type="button" className="koala-drawer-backdrop" aria-label="Close drawer" onClick={onClose} />
      <aside
        className={`koala-drawer-panel koala-drawer-panel--${position}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : ariaLabel}
      >
        {(title !== undefined) && (
          <header className="koala-drawer-header">
            {title && <div className="koala-drawer-title">{title}</div>}
            <Button size="sm" variant="transparent" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </Button>
          </header>
        )}
        {!title && (
          <div className="koala-drawer-close-only">
            <Button size="sm" variant="transparent" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </Button>
          </div>
        )}
        <div className="koala-drawer-body">{children}</div>
      </aside>
    </div>,
    document.body
  );
}

export default Drawer;

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import KoalaSidebar from '../koala/shell/Sidebar';

type Props = {
  open: boolean;
  onClose: () => void;
  domains?: DomainType[];
};

/** Mobile drawer — same Koala Product Sidebar as desktop. */
const MobileSidebar = ({ open, onClose, domains = [] }: Props) => {
  const router = useRouter();

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

  useEffect(() => {
    if (!open) return undefined;
    const close = () => onClose();
    router.events.on('routeChangeStart', close);
    return () => { router.events.off('routeChangeStart', close); };
  }, [open, onClose, router.events]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className={`mobile-sidebar-root${open ? ' mobile-sidebar-root--open' : ''}`} aria-hidden={!open}>
      <button type="button" className="mobile-sidebar-backdrop" aria-label="Close menu" onClick={onClose} />
      <div
        className={`mobile-sidebar-panel koala-mobile-panel${open ? ' mobile-sidebar-panel--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <KoalaSidebar domains={domains} onNavigate={onClose} />
      </div>
    </div>,
    document.body,
  );
};

export default MobileSidebar;

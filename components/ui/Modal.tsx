import React from 'react';
import { XIcon } from './icons';

interface ModalProps {
   title: string;
   onClose: () => void;
   children: React.ReactNode;
   width?: number;
   closeOnOverlayClick?: boolean;
}

const Modal = ({ title, onClose, children, width = 680, closeOnOverlayClick = true }: ModalProps) => (
   <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }}
      onClick={closeOnOverlayClick ? onClose : undefined}
   >
      <div
         onClick={(e) => e.stopPropagation()}
         style={{ background: '#fff', borderRadius: 16, width, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', boxShadow: '0px 24px 64px rgba(0,0,0,0.2)', animation: 'growOut 0.2s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'center' }}
      >
         {/* Header */}
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 24px 16px' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#09090B', fontFamily: 'var(--font-family-primary)' }}>{title}</h2>
            <button type="button" onClick={onClose} style={{ display: 'inline-flex', padding: 6, borderRadius: 8, border: '1px solid #E4E4E7', background: '#fff', color: '#52525C', cursor: 'pointer' }}>
               <XIcon size={16} />
            </button>
         </div>
         {children}
      </div>
   </div>
);

export default Modal;

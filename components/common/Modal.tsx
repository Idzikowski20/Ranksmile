import React from 'react';
import useOnKey from '../../hooks/useOnKey';

type ModalProps = {
   children: React.ReactNode,
   maxWidth?: number,
   title?: string,
   verticalCenter?: boolean,
   closeModal: Function,
}

const Modal = ({ children, maxWidth = 420, closeModal, title, verticalCenter = false }:ModalProps) => {
   useOnKey('Escape', closeModal);

   const closeOnBGClick = (e:React.SyntheticEvent) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      if (e.target === e.currentTarget) { closeModal(); }
   };

   return (
      <div
         onClick={closeOnBGClick}
         style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 200,
            display: 'flex',
            alignItems: verticalCenter ? 'center' : 'flex-start',
            justifyContent: 'center',
         }}
      >
         <div
            style={{
               maxWidth: `${maxWidth}px`,
               width: 'calc(100vw - 2rem)',
               background: '#FFFFFF',
               borderRadius: 16,
               padding: 24,
               position: 'relative',
               marginTop: verticalCenter ? 0 : '10vh',
               boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)',
               animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
               fontFamily: 'var(--font-family-primary)',
            }}
         >
            {title && (
               <h3 style={{ fontSize: 16, fontWeight: 600, color: '#18181B', marginBottom: 16, marginTop: 0 }}>
                  {title}
               </h3>
            )}
            <button
               onClick={() => closeModal()}
               style={{
                  position: 'absolute',
                  right: 12,
                  top: 12,
                  padding: 8,
                  cursor: 'pointer',
                  color: '#9CA3AF',
                  background: 'none',
                  border: 'none',
                  transition: 'color 150ms ease, transform 150ms ease',
               }}
               onMouseEnter={(e) => { (e.target as HTMLElement).style.color = '#374151'; (e.target as HTMLElement).style.transform = 'rotate(90deg)'; }}
               onMouseLeave={(e) => { (e.target as HTMLElement).style.color = '#9CA3AF'; (e.target as HTMLElement).style.transform = 'rotate(0deg)'; }}
            >
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
            </button>
            <div>{children}</div>
         </div>
      </div>
   );
};

export default Modal;

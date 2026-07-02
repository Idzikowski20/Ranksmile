import React, { useEffect } from 'react';

// AO-8a: top-right confirmation banner shown after an Auto-Optimize review is
// saved. Replaces the bottom `toast.success('Auto-Optimize changes saved')` call
// with a persistent, actionable card (design.md §16 card idiom + growOut).

export interface OptimizeSavedBannerProps {
   open: boolean;
   onOpenHistory: () => void;
   onClose: () => void;
}

const FONT = 'var(--font-family-primary)';
const AUTO_DISMISS_MS = 6000;

const OptimizeSavedBanner: React.FC<OptimizeSavedBannerProps> = ({ open, onOpenHistory, onClose }) => {
   useEffect(() => {
      if (!open) return undefined;
      const timer = setTimeout(onClose, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [open]);

   if (!open) return null;

   return (
      <div
         role="status"
         style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 10000,
            width: 320,
            maxWidth: 'calc(100vw - 32px)',
            background: '#FFFFFF',
            border: '1px solid #F4F4F5',
            borderRadius: 12,
            boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)',
            padding: 16,
            fontFamily: FONT,
            animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
         }}
      >
         <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ flexShrink: 0, display: 'inline-flex', marginTop: 1 }} aria-hidden="true">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="12" fill="#1AB25E" />
                  <path d="M7 12.5L10.2 15.5L17 8.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
               <p style={{ margin: 0, fontSize: 14, lineHeight: '20px', fontWeight: 600, color: '#18181B', fontFamily: FONT }}>
                  Your changes have been saved
               </p>
               <p style={{ margin: '2px 0 0', fontSize: 13, lineHeight: '18px', color: '#52525C', fontFamily: FONT }}>
                  You can see your changes in the Version History
               </p>

               <button
                  type="button"
                  onClick={onOpenHistory}
                  style={{
                     marginTop: 12,
                     fontSize: 13,
                     fontWeight: 600,
                     color: '#FFFFFF',
                     background: '#2F2F34',
                     border: 'none',
                     borderRadius: 8,
                     cursor: 'pointer',
                     fontFamily: FONT,
                     padding: '6px 14px',
                     transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#783AFB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
               >
                  Version History
               </button>
            </div>

            <button
               type="button"
               onClick={onClose}
               aria-label="Dismiss"
               style={{
                  flexShrink: 0,
                  background: 'transparent',
                  border: 'none',
                  padding: 4,
                  margin: '-4px -4px 0 0',
                  cursor: 'pointer',
                  color: '#9F9FA9',
                  display: 'inline-flex',
                  transition: 'color 0.15s ease',
               }}
               onMouseEnter={(e) => { e.currentTarget.style.color = '#52525C'; }}
               onMouseLeave={(e) => { e.currentTarget.style.color = '#9F9FA9'; }}
            >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
               </svg>
            </button>
         </div>
      </div>
   );
};

export default OptimizeSavedBanner;

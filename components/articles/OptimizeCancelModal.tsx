import React from 'react';

// AO-8a: confirmation modal shown when the user cancels an Auto-Optimize review.
// Cancelling discards every suggested change and restores the pre-optimize article,
// so we gate it behind an explicit confirm. Centered card over a scrim (design.md §16).

export interface OptimizeCancelModalProps {
   open: boolean;
   /** Closes the modal and stays in review. */
   onGoBack: () => void;
   /** Discards all suggestions and restores the pre-optimize article. */
   onConfirm: () => void;
}

const FONT = 'var(--font-family-primary)';

const goBackStyle: React.CSSProperties = {
   fontSize: 14,
   fontWeight: 600,
   color: '#2F2F34',
   background: '#F4F4F5',
   border: 'none',
   borderRadius: 6,
   cursor: 'pointer',
   fontFamily: FONT,
   padding: '6px 16px',
   transition: 'background 0.15s ease',
};

const confirmStyle: React.CSSProperties = {
   fontSize: 14,
   fontWeight: 600,
   color: '#FFFFFF',
   background: '#FF6F77',
   border: 'none',
   borderRadius: 6,
   cursor: 'pointer',
   fontFamily: FONT,
   padding: '6px 16px',
   transition: 'opacity 0.15s ease',
};

const OptimizeCancelModal: React.FC<OptimizeCancelModalProps> = ({ open, onGoBack, onConfirm }) => {
   if (!open) return null;

   return (
      <div
         role="dialog"
         aria-modal="true"
         aria-labelledby="ao-cancel-title"
         style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            fontFamily: FONT,
         }}
         onClick={onGoBack}
      >
         <div
            onClick={(e) => e.stopPropagation()}
            style={{
               width: 420,
               maxWidth: '100%',
               background: '#FFFFFF',
               border: '1px solid #F4F4F5',
               borderRadius: 12,
               boxShadow: '0px 18px 40px 0px rgba(17,24,39,0.14), 0px 8px 18px 0px rgba(17,24,39,0.09), 0px 2px 6px 0px rgba(17,24,39,0.06)',
               padding: 24,
               animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
         >
            <h2
               id="ao-cancel-title"
               style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600, color: '#18181B', fontFamily: FONT, margin: 0 }}
            >
               Cancel Auto-Optimize?
            </h2>
            <p style={{ fontSize: 14, lineHeight: '20px', color: '#52525C', fontFamily: FONT, margin: '12px 0 0' }}>
               All suggested changes will be discarded and the article restored to its pre-optimize state. This can’t be undone.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
               <button
                  type="button"
                  onClick={onGoBack}
                  style={goBackStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#E4E4E7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
               >
                  Go back
               </button>
               <button
                  type="button"
                  onClick={onConfirm}
                  style={confirmStyle}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
               >
                  Confirm cancel
               </button>
            </div>
         </div>
      </div>
   );
};

export default OptimizeCancelModal;

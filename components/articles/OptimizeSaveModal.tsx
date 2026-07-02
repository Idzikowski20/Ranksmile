import React from 'react';

// AO-8a: confirmation modal shown when the user clicks Save on an Auto-Optimize
// review. Mirrors OptimizeCancelModal structurally (420px card, growOut, same
// shadow/radius/fonts) — see design.md §16.

export interface OptimizeSaveModalProps {
   open: boolean;
   /** Closes the modal and stays in review. */
   onContinueEditing: () => void;
   /** Applies all undenied changes and persists the article. */
   onSave: () => void;
   saving?: boolean;
}

const FONT = 'var(--font-family-primary)';

const continueEditingStyle: React.CSSProperties = {
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

const saveStyle: React.CSSProperties = {
   fontSize: 14,
   fontWeight: 600,
   color: '#FFFFFF',
   background: '#2F2F34',
   border: 'none',
   borderRadius: 6,
   cursor: 'pointer',
   fontFamily: FONT,
   padding: '6px 16px',
   transition: 'background 0.15s ease, opacity 0.15s ease',
};

const OptimizeSaveModal: React.FC<OptimizeSaveModalProps> = ({ open, onContinueEditing, onSave, saving }) => {
   if (!open) return null;

   return (
      <div
         role="dialog"
         aria-modal="true"
         aria-labelledby="ao-save-title"
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
         onClick={onContinueEditing}
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
               id="ao-save-title"
               style={{ fontSize: 20, lineHeight: '28px', fontWeight: 600, color: '#18181B', fontFamily: FONT, margin: 0 }}
            >
               Save changes?
            </h2>
            <p style={{ fontSize: 14, lineHeight: '20px', color: '#52525C', fontFamily: FONT, margin: '12px 0 0' }}>
               Any changes you haven&apos;t rejected will be applied to your article.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
               <button
                  type="button"
                  onClick={onContinueEditing}
                  disabled={saving}
                  style={{ ...continueEditingStyle, opacity: saving ? 0.5 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#E4E4E7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
               >
                  Continue editing
               </button>
               <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  style={{ ...saveStyle, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
                  onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#783AFB'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
               >
                  {saving ? 'Saving…' : 'Save'}
               </button>
            </div>
         </div>
      </div>
   );
};

export default OptimizeSaveModal;

import React from 'react';
import { ShellPortal, overlayZ } from '../koala/overlay/ShellPortal';
import CompetitorsSection from './CompetitorsSection';

const FONT = 'var(--font-family-primary)';

const CloseIcon = () => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
   </svg>
);

interface Props {
   slug: string | undefined;
   keyword: string;
   onClose: () => void;
   onConfirm: () => void;
}

/**
 * Thin modal wrapper around the shared CompetitorsSection. Selection persists live inside
 * the section, so onConfirm just triggers the parent's audit recompute.
 */
const CompetitorsModal = ({ slug, keyword, onClose, onConfirm }: Props) => {
   const [saving, setSaving] = React.useState(false);

   return (
   <ShellPortal>
   <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: overlayZ.modal, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
   >
      <div style={{ position: 'relative', width: '100%', maxWidth: 1000, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', animation: 'growOut 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
         <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ position: 'absolute', right: 8, top: 8, padding: 8, border: 'none', background: 'transparent', color: '#9CA3AF', cursor: 'pointer', display: 'inline-flex', transition: 'color 150ms ease, transform 150ms ease', zIndex: 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#9CA3AF'; e.currentTarget.style.transform = 'none'; }}
         >
            <CloseIcon />
         </button>

         <div style={{ padding: '24px 24px 16px', flexShrink: 0 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#18181B', fontFamily: FONT, paddingRight: 32, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={keyword}>{keyword}</h2>
            <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 500, color: '#52525C', fontFamily: FONT }}>Organic Competitors</p>
         </div>

         <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }} className="styled-scrollbar">
            <CompetitorsSection slug={slug} keyword={keyword} onSavingChange={setSaving} />
         </div>

         <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: 16, borderTop: '1px solid #F4F4F5', flexShrink: 0 }}>
            <button
               type="button"
               onClick={onClose}
               style={{ border: 'none', boxShadow: 'inset 0 0 0 1px #E4E4E7', background: 'transparent', color: '#3F3F47', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer', transition: 'background 150ms ease' }}
               onMouseEnter={(e) => { e.currentTarget.style.background = '#F4F4F5'; }}
               onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
               Cancel
            </button>
            <button
               type="button"
               onClick={onConfirm}
               disabled={saving}
               style={{ border: 'none', background: '#2F2F34', color: '#fff', borderRadius: 6, padding: '8px 16px', fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, transition: 'background 150ms ease' }}
               onMouseEnter={(e) => { if (!saving) e.currentTarget.style.background = '#F84416'; }}
               onMouseLeave={(e) => { e.currentTarget.style.background = '#2F2F34'; }}
            >
               Let&apos;s go
            </button>
         </div>
      </div>
   </div>
   </ShellPortal>
   );
};

export default CompetitorsModal;

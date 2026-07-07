import React from 'react';
import { XIcon } from './icons';

const font = 'var(--font-family-primary)';

const SelectionBar = ({ count, onRemove, onClear }: { count: number; onRemove: () => void; onClear: () => void }) => (
   <div
      style={{
         position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 400,
         background: '#18181B', border: '1px solid #221E28', borderRadius: 12, padding: '8px 8px 8px 16px',
         display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
         animation: 'barSlideUp 0.2s cubic-bezier(0.16,1,0.3,1)', whiteSpace: 'nowrap', fontFamily: font,
      }}
   >
      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
         {count} {count === 1 ? 'page' : 'pages'} selected
      </span>
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.12)' }} />
      <button
         type="button"
         onClick={onRemove}
         style={{
            display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 8,
            border: 'none', background: 'rgba(255,111,119,0.12)', color: '#FF6F77',
            fontSize: 13, fontWeight: 600, fontFamily: font, cursor: 'pointer',
            transition: 'background 150ms ease',
         }}
         onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,111,119,0.20)'; }}
         onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,111,119,0.12)'; }}
      >
         Remove selected
      </button>
      <button
         type="button"
         aria-label="Clear selection"
         onClick={onClear}
         style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'background 150ms ease, color 150ms ease' }}
         onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#fff'; }}
         onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
      >
         <XIcon size={16} />
      </button>
   </div>
);

export default SelectionBar;

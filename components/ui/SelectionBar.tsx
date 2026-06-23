import React from 'react';
import { XIcon } from './icons';

const SelectionBar = ({ count, onRemove, onClear }: { count: number; onRemove: () => void; onClear: () => void }) => (
   <div style={{ position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 400, background: '#09090B', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0px 8px 32px rgba(0,0,0,0.28)', animation: 'barSlideUp 0.2s cubic-bezier(0.16,1,0.3,1)', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', fontFamily: 'var(--font-family-primary)' }}>{count} {count === 1 ? 'page' : 'pages'} selected</span>
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />
      <button type="button" onClick={onRemove} style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(255,111,119,0.3)', background: 'rgba(255,111,119,0.12)', color: '#FF6F77', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-family-primary)', cursor: 'pointer' }}>Remove selected</button>
      <button type="button" onClick={onClear} style={{ padding: 4, borderRadius: 6, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', display: 'inline-flex' }}><XIcon size={15} /></button>
   </div>
);

export default SelectionBar;

import React from 'react';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <div onClick={onChange} style={{ width: 28, height: 16, borderRadius: 9999, background: checked ? '#783AFB' : '#9F9FA9', position: 'relative', cursor: 'pointer', transition: 'background 250ms', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 2, left: checked ? 14 : 2, width: 12, height: 12, borderRadius: 9999, background: '#fff', transition: 'left 250ms', boxShadow: '0px 2px 8px rgba(24,26,34,0.04), 0px 1px 2px rgba(24,26,34,0.06)' }} />
  </div>
);

export default Toggle;

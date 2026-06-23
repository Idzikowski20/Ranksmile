// components/ui/Checkbox.tsx
import React from 'react';

const Checkbox = ({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
}) => (
  <span className="rec-cb-wrap" onClick={(e) => { e.stopPropagation(); onChange(); }}>
    <input
      type="checkbox"
      className="rec-cb-input"
      checked={checked}
      readOnly
      ref={(el) => {
          if (!el) return;
          // eslint-disable-next-line no-param-reassign
          el.indeterminate = !!indeterminate;
        }}
    />
    <svg viewBox="0 0 20 20" width="12" height="12" className="rec-cb-icon" fill="currentColor">
      {indeterminate && !checked
        ? <path d="M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
        : <path fillRule="evenodd" d="M16.705 4.153a.75.75 0 0 1 .142 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893l7.48-9.817a.75.75 0 0 1 1.05-.143" clipRule="evenodd" />
      }
    </svg>
  </span>
);

export default Checkbox;

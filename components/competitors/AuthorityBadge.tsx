import React from 'react';

/** Small shield badge for the Authority score (0–10), tinted by tier. */
const AuthorityBadge = ({ value }: { value: number | null }) => {
   if (value === null) {
      return <span style={{ fontSize: 13, fontWeight: 500, color: '#9F9FA9', fontFamily: 'var(--font-family-primary)' }}>—</span>;
   }
   const color = value >= 6 ? '#16A34A' : value >= 3 ? '#D97706' : '#DC2626';
   return (
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 28 }}>
         <svg width="24" height="28" viewBox="0 0 24 28" fill="none" aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
            <path d="M12 1 21 5v8c0 6-3.8 10.2-9 13-5.2-2.8-9-7-9-13V5l9-4Z" fill={color} fillOpacity="0.14" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
         </svg>
         <span style={{ position: 'relative', fontSize: 11, fontWeight: 700, color, fontFamily: 'var(--font-family-primary)', lineHeight: 1 }}>{value}</span>
      </span>
   );
};

export default AuthorityBadge;

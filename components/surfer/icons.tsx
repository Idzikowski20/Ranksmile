import React from 'react';

// ── Down-delta arrow ──────────────────────────────────────────────────────────
// Source: pages/sites/[domain]/recommendations.tsx lines 74–78
export const DeltaDown = () => (
   <svg width="8" height="6" viewBox="0 0 8 6" fill="none" style={{ flexShrink: 0, color: '#FF6F77' }}>
      <path d="M3.29289 4.79289L0.707107 2.20711C0.077142 1.57714 0.523309 0.5 1.41421 0.5H6.58579C7.47669 0.5 7.92286 1.57714 7.2929 2.20711L4.70711 4.79289C4.31658 5.18342 3.68342 5.18342 3.29289 4.79289Z" fill="currentColor" />
   </svg>
);

// ── Double ↑↓ sort arrow ──────────────────────────────────────────────────────
// Source: pages/sites/[domain]/recommendations.tsx lines 81–90
export const SortUpDown = ({ active, dir }: { active: boolean; dir: 'asc' | 'desc' | null }) => {
   let iconPath: React.ReactNode;
   if (active && dir === 'asc') {
      iconPath = <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v10.638l3.96-4.158a.75.75 0 1 1 1.08 1.04l-5.25 5.5a.75.75 0 0 1-1.08 0l-5.25-5.5a.75.75 0 1 1 1.08-1.04l3.96 4.158V3.75A.75.75 0 0 1 10 3" clipRule="evenodd" />;
   } else if (active && dir === 'desc') {
      iconPath = <path fillRule="evenodd" d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04L10.75 5.612V16.25A.75.75 0 0 1 10 17" clipRule="evenodd" />;
   } else {
      iconPath = <path fillRule="evenodd" d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06zm-4.31 9.81l3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06" clipRule="evenodd" />;
   }
   return (
      <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" style={{ flexShrink: 0, color: active ? '#09090B' : '#9F9FA9' }}>
         {iconPath}
      </svg>
   );
};

// ── X icon ────────────────────────────────────────────────────────────────────
// Source: pages/sites/[domain]/recommendations.tsx lines 160–164
export const XIcon = ({ size = 16 }: { size?: number }) => (
   <svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
   </svg>
);

// ── Search icon ───────────────────────────────────────────────────────────────
// Source: pages/sites/[domain]/recommendations.tsx search bar (~L1036) — verbatim path
export const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607" />
  </svg>
);

// ── Chevron down (fallback — no inline SVG found in recommendations.tsx) ──────
export const ChevronDown = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" aria-hidden="true">
    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

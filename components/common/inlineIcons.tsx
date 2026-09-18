import React from 'react';

/**
 * Inline SVG icons that were byte-identical copies in several components.
 * Extracted verbatim, so rendering is unchanged.
 */

export const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const SortArrow = ({ dir }: { dir: 'asc' | 'desc' | null }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ opacity: dir ? 1 : 0.45, transform: dir === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}><path d="M12 5v14m0 0l-5-5m5 5l5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const OpenDetailsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M13 17H16.75C17.99 17 19 15.99 19 14.75V5.25C19 4.01 17.99 3 16.75 3H13V17Z" fill="currentColor" /><path d="M11 3.5V16.5H3.25C2.28 16.5 1.5 15.72 1.5 14.75V5.25C1.5 4.28 2.28 3.5 3.25 3.5H11Z" stroke="currentColor" /></svg>
);

export const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M16 6V5.2c0-1.12 0-1.68-.22-2.11a2 2 0 0 0-.87-.87C14.48 2 13.92 2 12.8 2h-1.6c-1.12 0-1.68 0-2.11.22a2 2 0 0 0-.87.87C8 3.52 8 4.08 8 5.2V6M10 11.5v5M14 11.5v5M3 6h18M19 6v11.2c0 1.68 0 2.52-.33 3.16a3 3 0 0 1-1.31 1.31c-.64.33-1.48.33-3.16.33H9.8c-1.68 0-2.52 0-3.16-.33a3 3 0 0 1-1.31-1.31C5 19.72 5 18.88 5 17.2V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

export const DotsIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
   </svg>
);

export const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: '#9F9FA9', flexShrink: 0 }}><path d="M12 16v-4M12 8h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
);

export const PanelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
      <path d="M13 17H16.75C17.9926 17 19 15.9926 19 14.75V5.25C19 4.00736 17.9926 3 16.75 3H13V17Z" fill="currentColor" />
      <path d="M11 3.5V16.5H3.25C2.2835 16.5 1.5 15.7165 1.5 14.75V5.25C1.5 4.2835 2.2835 3.5 3.25 3.5H11Z" stroke="currentColor" />
   </svg>
);

import React from 'react';
import toast from 'react-hot-toast';

const font = 'var(--font-family-primary)';

const SearchIcon = () => (
  <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 0 0 0-11M2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9" clipRule="evenodd" />
  </svg>
);

/** Centered search trigger (mockup — opens nothing yet). */
const TopbarSearch = () => (
  <button
    type="button"
    onClick={() => toast('Search — coming soon!')}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      width: '100%',
      height: 40,
      padding: '0 12px',
      borderRadius: 9999,
      border: 'none',
      cursor: 'pointer',
      background: '#18181B',
      color: '#9F9FA9',
      fontFamily: font,
      fontSize: 14,
      fontWeight: 500,
      transition: 'opacity 150ms ease',
    }}
  >
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <SearchIcon />
      Search
    </span>
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 4, background: '#09090B', color: '#9F9FA9', fontSize: 14, lineHeight: '16px' }}>
      Ctrl+K
    </span>
  </button>
);

export default TopbarSearch;

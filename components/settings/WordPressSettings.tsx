import React, { useState } from 'react';
import WpConnectionsTable from '../wordpress/WpConnectionsTable';

const font = 'var(--font-family-primary)';
const DOCS_URL = 'https://docs.surferseo.com/en/articles/6328028-wordpress-plugin-explained';

const WordPressSettings = () => {
  const [hover, setHover] = useState(false);

  const emptyState = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: '#F8F8F9',
        borderRadius: 6,
      }}
    >
      <span style={{ fontSize: 14, color: '#3F3F47' }}>You haven&apos;t connected any accounts yet</span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, fontFamily: font, width: '100%' }}>
      <div style={{ width: '100%' }}>
        <WpConnectionsTable emptyState={emptyState} />
      </div>

      {/* How to connect link */}
      <a
        href={DOCS_URL}
        target="_blank"
        rel="noreferrer noopener"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          fontSize: 14,
          fontWeight: 500,
          color: hover ? '#783AFB' : '#18181B',
          textDecoration: 'none',
          transition: 'color 150ms ease',
        }}
      >
        How to connect
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" style={{ flexShrink: 0 }}>
          <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m8.25 4.5l7.5 7.5l-7.5 7.5" />
        </svg>
      </a>
    </div>
  );
};

export default WordPressSettings;

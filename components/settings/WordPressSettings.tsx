import React, { useState } from 'react';
import WpConnectionsTable from '../wordpress/WpConnectionsTable';
import { KoalaPanel, KoalaPanelBody, KoalaEmptyState } from '../koala/layout';

const DOCS_URL = 'https://ranksmile.pl';

const WordPressSettings = () => {
  const [hover, setHover] = useState(false);

  const emptyState = (
    <KoalaEmptyState
      title="No WordPress accounts"
      description="You haven't connected any accounts yet."
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 24, width: '100%' }}>
      <div style={{ width: '100%' }}>
        <KoalaPanel noPadding>
          <KoalaPanelBody>
            <WpConnectionsTable emptyState={emptyState} />
          </KoalaPanelBody>
        </KoalaPanel>
      </div>

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
          color: hover ? '#F84416' : '#18181B',
          textDecoration: 'none',
          transition: 'color 150ms ease',
          fontFamily: 'var(--font-family-primary)',
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

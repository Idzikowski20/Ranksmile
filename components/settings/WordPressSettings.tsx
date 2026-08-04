import React, { useCallback, useState } from 'react';
import WpConnectionsTable from '../wordpress/WpConnectionsTable';
import { WpConnectWizard } from '../wordpress/WpConnectWizard';
import { KoalaPanel, KoalaPanelBody } from '../koala/layout';
import { Icon } from '../koala/icons/Icon';
import { semantic } from '../koala/tokens/semantic';

const WordPressSettings = () => {
  const [showGuide, setShowGuide] = useState(false);
  const [hasConnections, setHasConnections] = useState(false);
  const onHasConnections = useCallback((has: boolean) => {
    setHasConnections(has);
    if (!has) setShowGuide(false);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 24,
        width: '100%',
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      <div style={{ width: '100%' }}>
        <KoalaPanel noPadding>
          <KoalaPanelBody>
            <WpConnectionsTable
              emptyState={<WpConnectWizard />}
              onHasConnections={onHasConnections}
            />
          </KoalaPanelBody>
        </KoalaPanel>
      </div>

      {hasConnections && showGuide ? (
        <div style={{ width: '100%' }}>
          <KoalaPanel noPadding>
            <KoalaPanelBody>
              <WpConnectWizard />
            </KoalaPanelBody>
          </KoalaPanel>
        </div>
      ) : null}

      {hasConnections ? (
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            color: semantic.text.primary,
            fontFamily: 'inherit',
          }}
        >
          {showGuide ? 'Hide connect guide' : 'How to connect'}
          <Icon
            name={showGuide ? 'CaretUp' : 'CaretRight'}
            size={16}
            weight="bold"
            color="currentColor"
          />
        </button>
      ) : null}
    </div>
  );
};

export default WordPressSettings;

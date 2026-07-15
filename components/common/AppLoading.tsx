import React from 'react';
import EditorLoading from '../articles/EditorLoading';
import AppShell from './AppShell';

const loadingPanelStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  background: '#f4f4f5',
  padding: 8,
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 12,
  minHeight: 0,
};

const loadingCardStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  background: '#fff',
  borderRadius: 12,
  border: '1px solid #e4e4e7',
  overflow: 'hidden',
};

/** Global bootstrap loading — same shell + spinner layout as the content editor. */
const AppLoading = ({
  message = 'Please wait a moment while we are loading the page',
}: {
  message?: string;
}) => (
  <AppShell
    domains={[]}
    showAddModal={() => {}}
    showSidebar
    topbarTitle=""
    contentClassName="article-editor-shell"
    hideMobileNav
  >
    <div style={loadingPanelStyle}>
      <div style={loadingCardStyle}>
        <EditorLoading message={message} />
      </div>
    </div>
  </AppShell>
);

export default AppLoading;

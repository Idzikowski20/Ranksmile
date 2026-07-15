import React from 'react';

const F = 'var(--font-family-primary)';

/** Surfer-style editor loading screen: purple spinner + setup message. */
const EditorLoading = ({ message = 'Please wait a few seconds, while we are setting up the Editor' }: { message?: string }) => (
  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, background: '#fff', fontFamily: F }}>
    <style>{'@keyframes editorLoadSpin { to { transform: rotate(360deg); } }'}</style>
    <div style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid #ece9fb', borderTopColor: '#F29964', animation: 'editorLoadSpin 0.7s linear infinite' }} />
    <span style={{ fontSize: 17, color: '#18181b', fontWeight: 400 }}>{message}</span>
  </div>
);

export default EditorLoading;

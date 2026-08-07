import React from 'react';
import { BounceSmileyAnimation } from '../common/BounceSmileyAnimation';

const F = 'var(--font-family-primary)';

/** Editor loading screen — Smily mark + setup message. */
const EditorLoading = ({ message = 'Please wait a few seconds, while we are setting up the Editor' }: { message?: string }) => (
  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, background: 'var(--koala-bg-primary)', fontFamily: F }}>
    <BounceSmileyAnimation compact size={56} entrance={false} />
    <span style={{ fontSize: 17, color: 'var(--koala-text-primary)', fontWeight: 400 }}>{message}</span>
  </div>
);

export default EditorLoading;

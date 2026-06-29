import React from 'react';
import SurfyMarkdown from './SurfyMarkdown';

type Props = {
  role: 'user' | 'assistant';
  message: string;
};

/** One Surfy chat message, Twenty-style in the app's light theme:
 *  user = subtle grey bubble (right, fit-content); assistant = plain markdown body (full width). */
const SurfyMessage = ({ role, message }: Props) => {
  if (role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div
          style={{
            maxWidth: '88%', background: '#f4f4f5', color: '#18181b',
            borderRadius: 12, borderBottomRightRadius: 4, padding: '8px 12px',
            fontSize: 14, lineHeight: '20px', fontWeight: 500,
            fontFamily: 'var(--font-family-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}
        >
          {message}
        </div>
      </div>
    );
  }
  return <SurfyMarkdown>{message}</SurfyMarkdown>;
};

export default SurfyMessage;

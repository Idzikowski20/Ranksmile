import React, { useEffect, useState } from 'react';
import EditorLoading from './EditorLoading';

type EditorComponent = typeof import('./ArticleEditor').default;
type EditorProps = React.ComponentProps<EditorComponent>;

/**
 * Client-only TipTap editor loader.
 * Avoids next/dynamic loadable — on Next 12 + React Strict Mode that path can
 * stay pending forever ("Loading editor…") even when chunks are reachable.
 */
export default function ArticleEditorClient(props: EditorProps) {
  const [Editor, setEditor] = useState<EditorComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import('./ArticleEditor')
      .then((mod) => {
        if (!cancelled) setEditor(() => mod.default);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load editor');
        }
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#fff',
          fontFamily: 'var(--font-family-primary)',
          padding: 24,
        }}
      >
        <p style={{ margin: 0, fontSize: 15, color: '#18181B' }}>Could not load the editor.</p>
        <p style={{ margin: 0, fontSize: 13, color: '#71717A', textAlign: 'center' }}>{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            height: 36,
            padding: '0 14px',
            borderRadius: 8,
            border: 'none',
            background: '#2F2F34',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'var(--font-family-primary)',
          }}
        >
          Reload page
        </button>
      </div>
    );
  }

  if (!Editor) {
    return <EditorLoading message="Loading editor…" />;
  }

  return <Editor {...props} />;
}

import React, { useEffect, useRef } from 'react';
import IconSurfy from './IconSurfy';

export type AILoadingLine = {
  text: string;
  done?: boolean;
  error?: boolean;
};

type AILoadingStateProps = {
  /** Current status label, e.g. "Editing the article". */
  status: string;
  /** Real tool / step lines — empty means header-only (no fake log). */
  lines?: AILoadingLine[];
  /** Kept for API compat; unused after Surfy icon swap. */
  progress?: number;
  style?: React.CSSProperties;
};

const LINE_HEIGHT = 28;
const VIEWPORT_LINES = 3;
const FONT = 'var(--font-family-primary)';
const MONO = "var(--font-family-mono, 'Roboto Mono', Monaco, Consolas, monospace)";

/** Activity-driven Surfy loader. Only shows a step log when real `lines` are provided. */
export default function AILoadingState({
  status,
  lines = [],
  style,
}: AILoadingStateProps) {
  const codeContainerRef = useRef<HTMLDivElement>(null);
  const showLog = lines.length > 0;
  const doneCount = lines.filter((l) => l.done).length;

  useEffect(() => {
    const el = codeContainerRef.current;
    if (!el || !showLog) return;
    el.scrollTop = el.scrollHeight;
  }, [lines.length, showLog, doneCount]);

  return (
    <div
      style={{
        display: 'flex',
        width: '100%',
        flexDirection: 'column',
        gap: showLog ? 12 : 0,
        fontFamily: FONT,
        ...style,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginLeft: 4,
          fontWeight: 500,
          color: '#6A6772',
        }}
      >
        <IconSurfy size={20} />
        <span style={{ fontSize: 13 }}>{status}{status.endsWith('...') ? '' : '...'}</span>
      </div>

      {showLog && (
        <div style={{ position: 'relative' }}>
          <div
            ref={codeContainerRef}
            style={{
              position: 'relative',
              height: LINE_HEIGHT * Math.min(VIEWPORT_LINES, Math.max(lines.length, 1)),
              maxHeight: LINE_HEIGHT * VIEWPORT_LINES,
              width: '100%',
              overflow: 'hidden',
              borderRadius: 8,
              fontFamily: MONO,
              fontSize: 12,
              scrollBehavior: 'smooth',
              background: '#FFFFFF',
              border: '1px solid #DAD9DE',
            }}
          >
            <div>
              {lines.map((line, i) => (
                <div
                  key={`${i}-${line.text}`}
                  style={{
                    display: 'flex',
                    height: LINE_HEIGHT,
                    alignItems: 'center',
                    padding: '0 8px',
                    opacity: line.error ? 1 : line.done ? 0.55 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      userSelect: 'none',
                      paddingRight: 12,
                      textAlign: 'right',
                      color: '#9F9FA9',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div
                    style={{
                      marginLeft: 4,
                      flex: 1,
                      color: line.error ? '#d97706' : '#302E36',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {line.text}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            aria-hidden
            style={{
              pointerEvents: 'none',
              position: 'absolute',
              inset: 0,
              borderRadius: 8,
              background:
                'linear-gradient(to bottom, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.45) 28%, transparent 55%, rgba(255,255,255,0.55) 100%)',
            }}
          />
        </div>
      )}
    </div>
  );
}

import React from 'react';
import { Button } from '../koala/core';
import { useEntrance } from '../../lib/motion/useEntrance';

export type OutlineGenerateBarProps = {
  busy: boolean;
  status?: string;
  progressPct?: number | null;
  headingCount: number;
  onGenerate: () => void;
  onCancel: () => void;
  rightReserve?: number;
};

/** Sticky bottom CTA — review outline → full article generate (Koala / editor zone). */
const OutlineGenerateBar: React.FC<OutlineGenerateBarProps> = ({
  busy,
  status,
  progressPct,
  headingCount,
  onGenerate,
  onCancel,
  rightReserve = 0,
}) => {
  const barEntranceRef = useEntrance<HTMLDivElement>({ y: 0 });
  const statusLabel = busy
    ? (status?.trim() || 'Generating article…')
    : `${headingCount} heading${headingCount === 1 ? '' : 's'} ready — edit freely, then generate`;

  return (
    <div
      ref={barEntranceRef}
      style={{
        position: 'fixed',
        bottom: 32,
        left: `calc((100vw - ${rightReserve}px) / 2)`,
        transform: 'translateX(-50%)',
        width: `min(calc((100vw - ${rightReserve}px) * 0.833), 1000px)`,
        zIndex: 10000,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '0 16px',
        borderRadius: 12,
        fontFamily: 'var(--font-family-primary)',
        background: 'var(--koala-bg-inverse, #1a1a1a)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
        color: 'var(--koala-text-on-inverse, #fff)',
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Outline</span>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          {busy && (
            <span
              role="status"
              aria-label="Loading"
              className="inline-block aspect-square animate-spin rounded-full"
              style={{
                width: 16,
                height: 16,
                border: '1.5px solid currentColor',
                borderBottomColor: 'transparent',
              }}
            />
          )}
          {busy && typeof progressPct === 'number' ? `${Math.round(progressPct)}%` : busy ? 'Writing…' : 'Review outline'}
        </span>
        <span
          style={{ fontSize: 12, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
          aria-live="polite"
        >
          {statusLabel}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onGenerate}
          disabled={busy || headingCount < 1}
          busy={busy}
        >
          {busy ? 'Generating…' : 'Generate'}
        </Button>
      </div>
    </div>
  );
};

export default OutlineGenerateBar;

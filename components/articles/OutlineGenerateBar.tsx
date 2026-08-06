import React from 'react';
import { Button } from '../koala/core';
import { Icon } from '../koala/icons';
import { useEntrance } from '../../lib/motion/useEntrance';

export type OutlineGenerateBarProps = {
  /** Outline is being planned — nothing to review or cancel yet. */
  planning?: boolean;
  /** Article is being written from the approved outline. */
  busy: boolean;
  status?: string;
  progressPct?: number | null;
  headingCount: number;
  onGenerate: () => void;
  onCancel: () => void;
  rightReserve?: number;
};

const SHELL: React.CSSProperties = {
  position: 'fixed',
  bottom: 32,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  fontFamily: 'var(--font-family-primary)',
  background: 'var(--koala-bg-inverse, #1a1a1a)',
  boxShadow: '0 8px 40px rgba(0,0,0,0.45)',
  color: 'var(--koala-text-on-inverse, #fff)',
};

const Spinner: React.FC = () => (
  <span
    role="status"
    aria-label="Loading"
    className="inline-block aspect-square animate-spin rounded-full"
    style={{ width: 16, height: 16, border: '1.5px solid currentColor', borderBottomColor: 'transparent' }}
  />
);

/** Work in progress — no controls, because there is nothing to act on yet. */
const ProgressPill: React.FC<{ label: string; rightReserve: number }> = ({ label, rightReserve }) => {
  const ref = useEntrance<HTMLDivElement>({ y: 0 });
  return (
    <div
      ref={ref}
      style={{
        ...SHELL,
        left: `calc((100vw - ${rightReserve}px) / 2)`,
        transform: 'translateX(-50%)',
        height: 44,
        gap: 10,
        padding: '0 20px',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
      aria-live="polite"
    >
      <Spinner />
      {label}
    </div>
  );
};

/** Sticky bottom CTA — review outline → full article generate (Koala / editor zone). */
const OutlineGenerateBar: React.FC<OutlineGenerateBarProps> = ({
  planning = false,
  busy,
  status,
  progressPct,
  headingCount,
  onGenerate,
  onCancel,
  rightReserve = 0,
}) => {
  const barEntranceRef = useEntrance<HTMLDivElement>({ y: 0 });

  if (planning) {
    return <ProgressPill label="Generating outline" rightReserve={rightReserve} />;
  }
  if (busy) {
    const pct = typeof progressPct === 'number' ? ` ${Math.round(progressPct)}%` : '';
    return <ProgressPill label={`Generating content${pct}`} rightReserve={rightReserve} />;
  }

  return (
    <div
      ref={barEntranceRef}
      style={{
        ...SHELL,
        left: `calc((100vw - ${rightReserve}px) / 2)`,
        transform: 'translateX(-50%)',
        width: `min(calc((100vw - ${rightReserve}px) * 0.833), 1000px)`,
        height: 52,
        justifyContent: 'space-between',
        gap: 12,
        padding: '0 16px',
        borderRadius: 12,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>Outline</span>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, flex: 1 }}>
        <span style={{ fontSize: 14 }}>Review outline</span>
        <span
          style={{ fontSize: 12, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
          aria-live="polite"
        >
          {status?.trim()
            || `${headingCount} heading${headingCount === 1 ? '' : 's'} ready — edit freely, then generate`}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={onGenerate}
          disabled={headingCount < 1}
          icon={<Icon name="Sparkle" size={16} weight="fill" />}
        >
          Generate content
        </Button>
      </div>
    </div>
  );
};

export default OutlineGenerateBar;

import React from 'react';
import { Icon } from '../koala/icons';
import { useEntrance } from '../../lib/motion/useEntrance';

export type OutlineGenerateBarProps = {
  /** Outline is being planned — nothing to review or cancel yet. */
  planning?: boolean;
  /** Article is being written from the approved outline. */
  busy: boolean;
  progressPct?: number | null;
  headingCount: number;
  onGenerate: () => void;
  rightReserve?: number;
};

/** Shared geometry: the three states are one control that changes label, not three bars. */
const PILL: React.CSSProperties = {
  height: 44,
  gap: 10,
  padding: '0 20px',
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: 'nowrap',
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
        ...PILL,
        left: `calc((100vw - ${rightReserve}px) / 2)`,
        transform: 'translateX(-50%)',
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
  progressPct,
  headingCount,
  onGenerate,
  rightReserve = 0,
}) => {
  const barEntranceRef = useEntrance<HTMLButtonElement>({ y: 0 });

  if (planning) {
    return <ProgressPill label="Generating outline" rightReserve={rightReserve} />;
  }
  if (busy) {
    const pct = typeof progressPct === 'number' ? ` ${Math.round(progressPct)}%` : '';
    return <ProgressPill label={`Generating content${pct}`} rightReserve={rightReserve} />;
  }

  const empty = headingCount < 1;

  // The same pill the two running states use, now clickable. It used to be a wide bar
  // restating "Outline / Review outline / N headings ready" — none of which the reviewer
  // needs, since the outline they are reading is the thing being described, and the bar
  // then changed shape on every state change.
  return (
    <button
      ref={barEntranceRef}
      type="button"
      onClick={onGenerate}
      disabled={empty}
      title={empty ? 'Add at least one heading to the outline first' : undefined}
      style={{
        ...SHELL,
        ...PILL,
        left: `calc((100vw - ${rightReserve}px) / 2)`,
        transform: 'translateX(-50%)',
        border: 'none',
        cursor: empty ? 'not-allowed' : 'pointer',
        opacity: empty ? 0.6 : 1,
      }}
    >
      <Icon name="Sparkle" size={16} weight="fill" />
      Generate content
    </button>
  );
};

export default OutlineGenerateBar;

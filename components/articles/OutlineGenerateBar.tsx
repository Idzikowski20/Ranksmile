import React from 'react';
import styled from '@emotion/styled';
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

/** Placement only. Inline because `left` is computed from a runtime prop. */
const SHELL: React.CSSProperties = {
  position: 'fixed',
  bottom: 32,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  fontFamily: 'var(--font-family-primary)',
};

const INVERSE_BG = 'var(--koala-bg-inverse, #1a1a1a)';
const INVERSE_FG = 'var(--koala-text-on-inverse, #fff)';
const LIFT = '0 8px 40px rgba(0,0,0,0.45)';

/** The black surface, shared by all three states. */
const SURFACE: React.CSSProperties = {
  background: INVERSE_BG,
  boxShadow: LIFT,
  color: INVERSE_FG,
};

/**
 * Same surface as the two progress states, but interactive. Emotion rather than `style`
 * because hover / active / focus-visible are pseudo-classes, and an inline `background`
 * would win over any rule that tried to change it. Mirrors the Koala `Button` contract:
 * 120ms background transition, `--shadow-focus` ring, dimmed + not-allowed when disabled.
 */
const PillButton = styled.button({
  ...SURFACE,
  border: 'none',
  cursor: 'pointer',
  transition: 'background 120ms ease, box-shadow 120ms ease, opacity 120ms ease',
  // Nudges the surface toward its own text colour, so it lightens on the dark pill and
  // darkens on the light one without needing a second token per theme.
  '&:hover:not(:disabled)': {
    background: `color-mix(in srgb, ${INVERSE_BG} 86%, ${INVERSE_FG})`,
  },
  '&:active:not(:disabled)': {
    background: `color-mix(in srgb, ${INVERSE_BG} 74%, ${INVERSE_FG})`,
  },
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `var(--shadow-focus), ${LIFT}`,
  },
  '&:disabled': {
    cursor: 'not-allowed',
    opacity: 0.6,
  },
});

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
        ...SURFACE,
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
    <PillButton
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
      }}
    >
      <Icon name="Sparkle" size={16} weight="fill" />
      Generate content
    </PillButton>
  );
};

export default OutlineGenerateBar;

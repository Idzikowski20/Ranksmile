import React from 'react';
import styled from '@emotion/styled';
import { useEntrance } from '@/components/motion/useEntrance';
import { Icon } from '../koala/icons';

export type OutlineGenerateBarProps = {
  headingCount: number;
  onGenerate: () => void;
  rightReserve?: number;
};

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

// No literal fallbacks: both vars are defined on every `[data-theme]` block, and the
// `#fff` this used to fall back to was wrong in dark and moonlight, where the inverse
// surface is near-white. A missing token should look broken, not silently unreadable.
const INVERSE_BG = 'var(--koala-bg-inverse)';
const INVERSE_FG = 'var(--koala-text-on-inverse)';
const LIFT = '0 8px 40px rgba(0,0,0,0.45)';

/**
 * The black pill, interactive. Emotion rather than `style` because hover / active /
 * focus-visible are pseudo-classes, and an inline `background` would win over any rule
 * that tried to change it. Mirrors the Koala `Button` contract: 120ms background
 * transition, `--shadow-focus` ring, dimmed + not-allowed when disabled.
 */
const PillButton = styled.button({
  background: INVERSE_BG,
  boxShadow: LIFT,
  color: INVERSE_FG,
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

/**
 * Sticky bottom CTA — review outline → full article generate (Koala / editor zone).
 * Progress while planning or writing is GenerationProgressBar's job; this bar only ever
 * offers the one action the reviewer has.
 */
const OutlineGenerateBar: React.FC<OutlineGenerateBarProps> = ({ headingCount, onGenerate, rightReserve = 0 }) => {
  const barEntranceRef = useEntrance<HTMLButtonElement>({ y: 0 });
  const empty = headingCount < 1;

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

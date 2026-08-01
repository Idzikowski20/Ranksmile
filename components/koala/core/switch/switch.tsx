import React from 'react';
import styled from '@emotion/styled';

interface SwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'lg';
  'aria-label'?: string;
  name?: string;
}

const WRAPPER_SIZE = { sm: { width: 36, height: 20 }, lg: { width: 44, height: 24 } } as const;
const KNOB_SIZE = { sm: { width: 16, height: 16 }, lg: { width: 20, height: 20 } } as const;

/** Flat Koala switch — no Sentry chonk borders. */
const HiddenCheckbox = styled.input<{ $sz: NonNullable<SwitchProps['size']> }>`
  position: absolute;
  opacity: 0;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  margin: 0;

  &:focus-visible + div {
    outline: 2px solid var(--koala-focus);
    outline-offset: 2px;
  }

  & + div {
    background: var(--koala-border-primary);
    border: 1px solid var(--koala-border-primary);
    transition: background 120ms ease, border-color 120ms ease;

    > div {
      background: var(--koala-bg-primary);
      border: none;
      box-shadow: var(--shadow-1);
      transition: transform 120ms ease;
      transform: translate(2px, 1px);
    }
  }

  &:checked + div {
    background: var(--koala-brand);
    border-color: var(--koala-brand);

    > div {
      transform: translate(${({ $sz }) => WRAPPER_SIZE[$sz].width - KNOB_SIZE[$sz].width - 2}px, 1px);
    }
  }

  &:disabled {
    cursor: not-allowed;
    & + div {
      opacity: 0.5;
    }
  }
`;

const Track = styled.div<{ $sz: NonNullable<SwitchProps['size']> }>(({ $sz }) => ({
  position: 'relative',
  width: WRAPPER_SIZE[$sz].width,
  height: WRAPPER_SIZE[$sz].height,
  borderRadius: 999,
  pointerEvents: 'none',
  display: 'inline-flex',
  flexShrink: 0,
  overflow: 'hidden',
}));

const Knob = styled.div<{ $sz: NonNullable<SwitchProps['size']> }>(({ $sz }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: KNOB_SIZE[$sz].width,
  height: KNOB_SIZE[$sz].height,
  borderRadius: 999,
}));

export function Switch({ size = 'sm', onChange, checked, disabled, ...rest }: SwitchProps) {
  return (
    <div style={{ display: 'inline-flex', justifyContent: 'start', position: 'relative', flexShrink: 0 }}>
      <HiddenCheckbox
        type="checkbox"
        $sz={size}
        checked={checked}
        disabled={disabled}
        aria-label={rest['aria-label']}
        name={rest.name}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <Track $sz={size}>
        <Knob $sz={size} />
      </Track>
    </div>
  );
}

export default Switch;

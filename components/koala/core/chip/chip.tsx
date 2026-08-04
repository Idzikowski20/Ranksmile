import React from 'react';
import styled from '@emotion/styled';
import { Icon } from '../../icons/Icon';

export type ChipSize = 'sm' | 'md';

export type ChipProps = {
  children: React.ReactNode;
  selected?: boolean;
  disabled?: boolean;
  /** Leading icon (Phosphor PascalCase name) or custom node. */
  icon?: string | React.ReactNode;
  size?: ChipSize;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** When set, shows dismiss (X) control; stops propagation on click. */
  onDismiss?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  'aria-label'?: string;
};

const SIZE: Record<ChipSize, { height: number; padX: number; fontSize: number; gap: number; icon: number }> = {
  sm: { height: 24, padX: 8, fontSize: 12, gap: 4, icon: 12 },
  md: { height: 32, padX: 10, fontSize: 13, gap: 6, icon: 14 },
};

const Root = styled.button<{
  $selected: boolean;
  $disabled: boolean;
  $size: ChipSize;
  $interactive: boolean;
}>(({ $selected, $disabled, $size, $interactive }) => {
  const s = SIZE[$size];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: s.gap,
    height: s.height,
    padding: `0 ${s.padX}px`,
    fontSize: s.fontSize,
    fontWeight: 500,
    fontFamily: 'var(--font-family-primary)',
    lineHeight: 1,
    whiteSpace: 'nowrap' as const,
    borderRadius: 999,
    border: `1px solid ${$selected ? 'var(--koala-text-brand)' : 'var(--koala-border-primary)'}`,
    background: $selected
      ? 'var(--koala-bg-brand-subtle, color-mix(in srgb, var(--koala-text-brand) 12%, transparent))'
      : 'var(--koala-bg-primary)',
    color: $selected ? 'var(--koala-text-brand)' : 'var(--koala-text-primary)',
    cursor: $disabled ? 'not-allowed' : $interactive ? 'pointer' : 'default',
    opacity: $disabled ? 0.5 : 1,
    boxSizing: 'border-box' as const,
    transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
    outline: 'none',
    '&:hover:not(:disabled)': $interactive
      ? {
          background: $selected
            ? 'var(--koala-bg-brand-subtle, color-mix(in srgb, var(--koala-text-brand) 16%, transparent))'
            : 'var(--koala-bg-secondary)',
        }
      : undefined,
    '&:focus-visible': {
      boxShadow: '0 0 0 2px var(--koala-bg-primary), 0 0 0 4px var(--koala-focus-ring, var(--koala-text-brand))',
    },
  };
});

const Dismiss = styled.button<{ $size: ChipSize }>(({ $size }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginLeft: 2,
  marginRight: -4,
  width: SIZE[$size].icon + 4,
  height: SIZE[$size].icon + 4,
  padding: 0,
  border: 'none',
  background: 'transparent',
  borderRadius: '50%',
  color: 'inherit',
  opacity: 0.7,
  flexShrink: 0,
  cursor: 'pointer',
  '&:hover:not(:disabled)': { opacity: 1, background: 'rgba(0,0,0,0.06)' },
  '&:disabled': { cursor: 'not-allowed' },
}));

/**
 * Interactive filter / removable tag — Figma Chip `11196:273025`.
 * Not a status label (use Badge).
 */
export function Chip({
  children,
  selected = false,
  disabled = false,
  icon,
  size = 'md',
  onClick,
  onDismiss,
  className,
  type = 'button',
  'aria-label': ariaLabel,
}: ChipProps) {
  const s = SIZE[size];
  const interactive = Boolean(onClick) || Boolean(onDismiss);

  const leading =
    typeof icon === 'string' ? <Icon name={icon} size={s.icon} weight="bold" /> : icon;

  return (
    <Root
      type={type}
      className={className}
      $selected={selected}
      $disabled={disabled}
      $size={size}
      $interactive={interactive}
      disabled={disabled}
      aria-pressed={onClick ? selected : undefined}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onClick}
    >
      {leading}
      <span>{children}</span>
      {onDismiss ? (
        <Dismiss
          type="button"
          $size={size}
          disabled={disabled}
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) onDismiss(e);
          }}
        >
          <Icon name="X" size={s.icon} weight="bold" />
        </Dismiss>
      ) : null}
    </Root>
  );
}

export default Chip;

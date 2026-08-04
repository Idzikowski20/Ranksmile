import React, { useState } from 'react';
import styled from '@emotion/styled';
import { semantic } from '../../tokens/semantic';
import { typeface } from '../../tokens/typography';
import type { ButtonProps, ButtonSize, ButtonVariant } from './types';

/** Flat Koala Button — theme via semantic CSS vars (no light-only hardcodes). */

const BTN_SIZES: Record<ButtonSize, { height: string; fontSize: string; padding: string; radius: string }> = {
  md: { height: '36px', fontSize: '14px', padding: '6px 12px', radius: '12px' },
  sm: { height: '32px', fontSize: '14px', padding: '6px 10px', radius: '12px' },
  xs: { height: '28px', fontSize: '12px', padding: '4px 8px', radius: '10px' },
  zero: { height: '24px', fontSize: '12px', padding: '0', radius: '8px' },
};

function colors(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return {
        bg: semantic.button.brand.bg,
        hover: semantic.button.brand.bgHover,
        fg: semantic.button.brand.fg,
        border: 'transparent',
      };
    case 'danger':
      return {
        bg: semantic.status.danger,
        hover: semantic.status.danger,
        fg: semantic.text.onBrand,
        border: 'transparent',
      };
    case 'warning':
      return {
        bg: semantic.status.warning,
        hover: semantic.status.warning,
        fg: semantic.background.inverse,
        border: 'transparent',
      };
    case 'secondary':
      return {
        bg: semantic.button.secondary.bg,
        hover: semantic.button.secondary.bgHover,
        fg: semantic.button.secondary.fg,
        border: semantic.button.secondary.border,
      };
    case 'transparent':
      return {
        bg: 'transparent',
        hover: semantic.button.ghost.bgHover,
        fg: semantic.button.ghost.fg,
        border: 'transparent',
      };
    case 'link':
      return {
        bg: 'transparent',
        hover: 'transparent',
        fg: semantic.text.link,
        border: 'transparent',
      };
  }
}

const Root = styled.button<{
  $size: ButtonSize;
  $variant: ButtonVariant;
  $busy: boolean;
  $hover: boolean;
  $iconOnly: boolean;
}>(({ $size, $variant, $busy, $hover, $iconOnly }) => {
  const sz = BTN_SIZES[$size];
  const c = colors($variant);
  const isLink = $variant === 'link';
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    whiteSpace: 'nowrap',
    fontWeight: 500,
    fontFamily: typeface.body,
    cursor: $busy ? 'wait' : 'pointer',
    height: sz.height,
    minHeight: sz.height,
    minWidth: $iconOnly ? sz.height : undefined,
    padding: $iconOnly ? '0' : sz.padding,
    borderRadius: sz.radius,
    border: c.border === 'transparent' ? '1px solid transparent' : `1px solid ${c.border}`,
    background: $hover && !isLink ? c.hover : c.bg,
    color: isLink && $hover ? semantic.text.brand : c.fg,
    fontSize: sz.fontSize,
    lineHeight: '20px',
    letterSpacing: '-0.4px',
    outline: 'none',
    textDecoration: isLink && $hover ? 'underline' : 'none',
    opacity: $busy ? 0.75 : 1,
    transition: 'background 120ms ease, color 120ms ease, border-color 120ms ease',
    '&:focus-visible': {
      boxShadow: 'var(--shadow-focus)',
    },
    '&[disabled]': {
      opacity: 0.5,
      cursor: 'var(--koala-cursor-not-allowed)',
    },
  };
});

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((
  {
    busy = false,
    icon,
    size = 'md',
    variant = 'secondary',
    children,
    disabled,
    onMouseEnter,
    onMouseLeave,
    type = 'button',
    'aria-label': ariaLabel,
    ...rest
  },
  ref,
) => {
  const [hover, setHover] = useState(false);
  const iconOnly = Boolean(icon && !children);
  return (
    <Root
      ref={ref}
      type={type}
      $size={size}
      $variant={variant}
      $busy={busy}
      $hover={hover}
      $iconOnly={iconOnly}
      disabled={disabled || busy}
      aria-label={ariaLabel}
      onMouseEnter={(e) => {
        setHover(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHover(false);
        onMouseLeave?.(e);
      }}
      {...rest}
    >
      {icon}
      {children}
    </Root>
  );
});
Button.displayName = 'Button';

export { Button };
export default Button;

import React, { useState } from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';

export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'warning' | 'link' | 'transparent';
export type ButtonSize = 'zero' | 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  busy?: boolean;
  icon?: React.ReactNode;
  size?: ButtonSize;
  variant?: ButtonVariant;
  children?: React.ReactNode;
  'aria-label'?: string;
}

const SIZES: Record<ButtonSize, { height: string; fontSize: string; padding: string; radius: string }> = {
  lg: { height: '44px', fontSize: '16px', padding: '10px 14px', radius: '14px' },
  md: { height: '36px', fontSize: '14px', padding: '6px 12px', radius: '12px' },
  sm: { height: '32px', fontSize: '14px', padding: '6px 10px', radius: '12px' },
  xs: { height: '28px', fontSize: '12px', padding: '4px 8px', radius: '10px' },
  zero: { height: '24px', fontSize: '12px', padding: '0', radius: '8px' },
};

function colors(variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { bg: semantic.button.brand.bg, hover: semantic.button.brand.bgHover, fg: semantic.button.brand.fg, border: 'transparent' };
    case 'danger':
      return { bg: semantic.status.danger, hover: semantic.status.danger, fg: semantic.text.onBrand, border: 'transparent' };
    case 'warning':
      return { bg: semantic.status.warning, hover: semantic.status.warning, fg: semantic.background.inverse, border: 'transparent' };
    case 'secondary':
      return {
        bg: semantic.button.secondary.bg,
        hover: semantic.button.secondary.bgHover,
        fg: semantic.button.secondary.fg,
        border: semantic.button.secondary.border,
      };
    case 'transparent':
      return { bg: 'transparent', hover: semantic.button.ghost.bgHover, fg: semantic.button.ghost.fg, border: 'transparent' };
    case 'link':
      return { bg: 'transparent', hover: 'transparent', fg: semantic.text.link, border: 'transparent' };
  }
}

const Root = styled.button<{
  $size: ButtonSize;
  $variant: ButtonVariant;
  $busy: boolean;
  $hover: boolean;
}>(({ $size, $variant, $busy, $hover }) => {
  const sz = SIZES[$size];
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
    cursor: $busy ? 'var(--koala-cursor-not-allowed)' : 'var(--koala-cursor-pointing)',
    height: sz.height,
    minHeight: sz.height,
    padding: sz.padding,
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

export default function Button({
  busy = false,
  icon,
  size = 'md',
  variant = 'secondary',
  children,
  disabled,
  onMouseEnter,
  onMouseLeave,
  type = 'button',
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  return (
    <Root
      type={type}
      $size={size}
      $variant={variant}
      $busy={busy}
      $hover={hover}
      disabled={disabled || busy}
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
}

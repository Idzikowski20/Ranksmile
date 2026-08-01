import React, { useState } from 'react';
import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import type { ButtonProps, ButtonSize, ButtonVariant } from './types';

/** PostHog LemonButton chrome-depth (~0.1875rem). Reserved inside the button box. */
const BTN_ELEVATION: Record<ButtonSize, string> = { md: '3px', sm: '3px', xs: '2px', zero: '0px' };
const HOVER_LIFT = '-1px';

const BTN_SIZES = {
  md: { height: '36px', minHeight: '36px', fontSize: '0.875rem', lineHeight: '1rem', padding: '8px 16px', borderRadius: '8px' },
  sm: { height: '32px', minHeight: '32px', fontSize: '0.875rem', lineHeight: '1rem', padding: '6px 12px', borderRadius: '6px' },
  xs: { height: '24px', minHeight: '24px', fontSize: '0.75rem', lineHeight: '1rem', padding: '4px 8px', borderRadius: '5px' },
  zero: { height: '24px', minHeight: '24px', fontSize: '0.75rem', lineHeight: '1rem', padding: '0', borderRadius: '4px' },
} as const;

type ThemeColors = { surface: string; chonk: string; content: string };
function getColors(variant: ButtonVariant): ThemeColors {
  switch (variant) {
    case 'primary': return { surface: '#F29964', chonk: '#c97e52', content: '#FFFFFF' };
    case 'danger': return { surface: '#FF002B', chonk: '#C10000', content: '#FFFFFF' };
    case 'warning': return { surface: '#FFCE00', chonk: '#D59600', content: '#000000' };
    case 'secondary': return { surface: '#FFFFFF', chonk: '#bebebe', content: '#181225' };
    case 'transparent': return { surface: 'transparent', chonk: 'transparent', content: '#6A6772' };
    case 'link': return { surface: 'transparent', chonk: 'transparent', content: '#E07D42' };
  }
}

const busyBar = keyframes`
  0% { transform: scaleX(0); transform-origin: left; }
  50% { transform: scaleX(1); transform-origin: left; }
  50.01% { transform: scaleX(1); transform-origin: right; }
  100% { transform: scaleX(0); transform-origin: right; }
`;

const pressEase = '120ms cubic-bezier(0.8, -0.4, 0.5, 1)';

const ChonkBtn = styled.button<{ $size: ButtonSize; $variant: ButtonVariant; $iconOnly: boolean; $hover: boolean; $active: boolean; $busy: boolean }>(
  ({ $size, $variant, $iconOnly, $hover, $active, $busy }) => {
    const sz = BTN_SIZES[$size];
    const el = BTN_ELEVATION[$size];
    const c = getColors($variant);
    const isChonk = $variant !== 'transparent' && $variant !== 'link';
    const pressed = $active && !$busy;
    const hovering = $hover && !$busy && !pressed;

    return {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      whiteSpace: 'nowrap',
      fontWeight: 500,
      fontFamily: "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif",
      cursor: $busy ? 'wait' : 'pointer',
      padding: $iconOnly ? '0' : sz.padding,
      borderRadius: sz.borderRadius,
      border: 'none',
      color: $variant === 'link' ? ($hover ? '#C97D52' : '#E07D42') : c.content,
      background: 'none',
      height: sz.height,
      minWidth: $iconOnly ? sz.height : undefined,
      minHeight: sz.minHeight,
      fontSize: sz.fontSize,
      lineHeight: sz.lineHeight,
      outline: 'none',
      ...(isChonk ? {
        /*
          Outer frame — wraps face + chonk ledge (full inset:0).
          Do NOT use inset:-1px with an empty ::before: the hole between
          shortened ::after and the frame shows page bg (= white gap).
        */
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          border: `1px solid ${c.chonk}`,
          background: c.chonk,
          pointerEvents: 'none',
          zIndex: 0,
        },
        /*
          Face sits above the chonk fill. bottom:el reserves the ledge;
          face bottom border sits directly on the chonk (no gap).
        */
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: pressed ? 0 : el,
          background: c.surface,
          borderRadius: 'inherit',
          border: `1px solid ${c.chonk}`,
          boxShadow: 'none',
          transform: hovering ? `translateY(${HOVER_LIFT})` : 'none',
          transition: `transform ${pressEase}, bottom ${pressEase}`,
          pointerEvents: 'none',
          zIndex: 0,
        },
      } : {
        background: $variant === 'transparent' && $hover ? '#0000200F' : 'transparent',
        transition: 'background 120ms cubic-bezier(0.72, 0, 0.16, 1)',
        textDecoration: $variant === 'link' && $hover ? 'underline' : 'none',
      }),
      '&:focus-visible': isChonk ? {
        '&::after': {
          border: '1px solid #F29964',
          boxShadow: '0 0 0 1px #F29964',
        },
        '&::before': {
          border: '1px solid #F29964',
        },
      } : {
        outline: '2px solid #F29964',
        outlineOffset: 2,
      },
      '&[disabled]': {
        cursor: 'not-allowed',
        opacity: 0.6,
      },
    };
  }
);

const ContentSpan = styled.span<{ $shift: string }>(({ $shift }) => ({
  position: 'relative',
  zIndex: 1,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  transform: `translateY(${$shift})`,
  transition: `transform ${pressEase}`,
}));

const BusyBar = styled.span`
  position: absolute; bottom: 0; left: 0; right: 0; height: 3px;
  background: currentColor; opacity: 0.3; z-index: 3;
  animation: ${busyBar} 1.8s ease-in-out infinite;
`;

export function Button({
  variant = 'primary', size = 'md', busy, icon, children, disabled,
  onClick, onMouseDown, onMouseUp, onMouseEnter, onMouseLeave,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const isIconOnly = !children && !!icon;
  const el = BTN_ELEVATION[size];
  const isChonk = variant !== 'transparent' && variant !== 'link';
  const pressed = active && !busy;
  const hovering = hover && !busy && !pressed;
  /* Deep press: content drops by full elevation. Hover: subtle lift like PostHog. */
  const contentShift = !isChonk ? '0' : (pressed ? el : (hovering ? HOVER_LIFT : '0'));

  return (
    <ChonkBtn
      $size={size}
      $variant={variant}
      $iconOnly={isIconOnly}
      $hover={hover}
      $active={active}
      $busy={!!busy}
      disabled={disabled || busy}
      onClick={onClick}
      onMouseDown={(e) => { setActive(true); onMouseDown?.(e); }}
      onMouseUp={(e) => { setActive(false); onMouseUp?.(e); }}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); setActive(false); onMouseLeave?.(e); }}
      {...rest}
    >
      <ContentSpan $shift={contentShift}>
        {icon}
        {children}
      </ContentSpan>
      {busy && <BusyBar />}
    </ChonkBtn>
  );
}

export default Button;

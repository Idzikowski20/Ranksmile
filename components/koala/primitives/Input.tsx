import React, { forwardRef, useState } from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';
import { Icon } from '../icons/Icon';

type InputSize = 'xs' | 'sm' | 'md' | 'lg';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  monospace?: boolean;
  hasError?: boolean;
  leadingItems?: React.ReactNode;
  trailingItems?: React.ReactNode;
  /** Built-in show/hide for password fields. */
  revealable?: boolean;
}

const FORM: Record<InputSize, { height: string; fontSize: string; padding: string; radius: string }> = {
  lg: { height: '44px', fontSize: '16px', padding: '10px 14px', radius: '14px' },
  md: { height: '40px', fontSize: '14px', padding: '8px 12px', radius: '12px' },
  sm: { height: '36px', fontSize: '14px', padding: '6px 10px', radius: '12px' },
  xs: { height: '32px', fontSize: '12px', padding: '4px 8px', radius: '10px' },
};

const StyledInput = styled.input<{
  $sz: InputSize;
  $mono: boolean;
  $err: boolean;
  $padL: number;
  $padR: number;
}>(({ $sz, $mono, $err, $padL, $padR }) => {
  const cfg = FORM[$sz];
  return {
    display: 'block',
    width: '100%',
    color: semantic.text.primary,
    backgroundColor: semantic.input.bg,
    border: $err ? `1px solid ${semantic.input.borderError}` : `1px solid ${semantic.input.border}`,
    fontFamily: $mono ? typeface.mono : typeface.body,
    fontWeight: 400,
    fontSize: cfg.fontSize,
    height: cfg.height,
    lineHeight: '20px',
    minHeight: cfg.height,
    padding: cfg.padding,
    paddingLeft: $padL,
    paddingRight: $padR,
    borderRadius: cfg.radius,
    letterSpacing: '-0.4px',
    transition: 'border 0.12s ease, box-shadow 0.12s ease',
    outline: 'none',
    '&::placeholder': {
      color: semantic.input.placeholder,
      opacity: 1,
    },
    '&[disabled]': {
      color: semantic.text.disabled,
      cursor: 'var(--koala-cursor-not-allowed)',
      opacity: 0.6,
    },
    '&:hover:not([disabled]):not(:focus)': {
      borderColor: semantic.input.borderHover,
    },
    '&:focus, &:focus-visible': {
      borderColor: $err ? semantic.input.borderError : semantic.input.borderFocus,
      boxShadow: $err
        ? `0 0 0 2px var(--koala-bg-primary), 0 0 0 4px ${semantic.input.borderError}`
        : 'var(--shadow-focus)',
    },
  };
});

const Wrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
`;

const LeadSlot = styled.div`
  position: absolute;
  left: 10px;
  display: flex;
  align-items: center;
  pointer-events: none;
  color: ${semantic.text.tertiary};
  & > * {
    pointer-events: auto;
  }
`;

const TrailSlot = styled.div`
  position: absolute;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  & > * {
    pointer-events: auto;
  }
`;

const IconBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  padding: 2px;
  cursor: pointer;
  color: ${semantic.text.secondary};
  border-radius: 6px;
  &:hover {
    color: ${semantic.text.primary};
  }
`;

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    size = 'md',
    monospace = false,
    hasError = false,
    leadingItems,
    trailingItems,
    revealable = false,
    type,
    style,
    ...rest
  },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === 'password' || revealable;
  const resolvedType = isPassword && revealable ? (revealed ? 'text' : 'password') : type;

  const padL = leadingItems ? 36 : undefined;
  const trail = (
    <>
      {trailingItems}
      {revealable ? (
        <IconBtn
          type="button"
          tabIndex={-1}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          onClick={() => setRevealed((v) => !v)}
        >
          <Icon name={revealed ? 'EyeSlash' : 'Eye'} size={16} weight="bold" />
        </IconBtn>
      ) : null}
    </>
  );
  const hasTrail = Boolean(trailingItems) || revealable;
  const padR = hasTrail ? 36 : undefined;

  const cfg = FORM[size];
  const basePad = parseInt(cfg.padding.split(' ')[1] || '12', 10);

  if (!leadingItems && !hasTrail) {
    return (
      <StyledInput
        ref={ref}
        $sz={size}
        $mono={monospace}
        $err={hasError}
        $padL={basePad}
        $padR={basePad}
        type={resolvedType}
        style={style}
        {...rest}
      />
    );
  }

  return (
    <Wrapper>
      {leadingItems ? <LeadSlot>{leadingItems}</LeadSlot> : null}
      <StyledInput
        ref={ref}
        $sz={size}
        $mono={monospace}
        $err={hasError}
        $padL={padL ?? basePad}
        $padR={padR ?? basePad}
        type={resolvedType}
        style={style}
        {...rest}
      />
      {hasTrail ? <TrailSlot>{trail}</TrailSlot> : null}
    </Wrapper>
  );
});

export default Input;

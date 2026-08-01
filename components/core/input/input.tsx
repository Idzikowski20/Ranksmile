import React from 'react';
import styled from '@emotion/styled';

type InputSize = 'xs' | 'sm' | 'md';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  monospace?: boolean;
  hasError?: boolean;
  trailingItems?: React.ReactNode;
}

const FORM: Record<InputSize, { height: string; minHeight: string; fontSize: string; lineHeight: string; pt: number; pb: number; pl: number; pr: number; radius: string }> = {
  md: { height: '36px', minHeight: '36px', fontSize: '0.875rem', lineHeight: '1rem', pt: 12, pb: 12, pl: 16, pr: 16, radius: '8px' },
  sm: { height: '32px', minHeight: '32px', fontSize: '0.875rem', lineHeight: '1rem', pt: 8, pb: 8, pl: 12, pr: 12, radius: '6px' },
  xs: { height: '28px', minHeight: '28px', fontSize: '0.75rem', lineHeight: '1rem', pt: 6, pb: 6, pl: 8, pr: 8, radius: '5px' },
};

const StyledInput = styled.input<{ $sz: InputSize; $mono: boolean; $err: boolean }>(({ $sz, $mono, $err }) => {
  const cfg = FORM[$sz];
  return {
    display: 'block',
    width: '100%',
    color: '#302E36',
    backgroundColor: '#FFFFFF',
    boxShadow: 'none',
    border: $err ? '1px solid #FF002B' : '1px solid #dbded4',
    fontFamily: $mono
      ? "'Roboto Mono', Monaco, Consolas, 'Courier New', monospace"
      : "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif",
    fontWeight: 400,
    fontSize: cfg.fontSize,
    height: cfg.height,
    lineHeight: cfg.lineHeight,
    minHeight: cfg.minHeight,
    paddingTop: cfg.pt,
    paddingBottom: cfg.pb,
    paddingLeft: cfg.pl,
    paddingRight: cfg.pr,
    borderRadius: cfg.radius,
    transition: 'border 0.12s cubic-bezier(0.72, 0, 0.16, 1), box-shadow 0.12s cubic-bezier(0.72, 0, 0.16, 1)',
    outline: 'none',
    '&::placeholder': {
      color: '#6A6772',
      opacity: 1,
    },
    '&[disabled]': {
      color: '#878490',
      cursor: 'not-allowed',
      opacity: '60%',
    },
    '&:focus, &:focus-visible': {
      borderColor: '#F29964',
      boxShadow: '0 0 0 2px #FFFFFF, 0 0 0 4px #F29964',
    },
    '&[type="number"]': {
      appearance: 'textfield',
      MozAppearance: 'textfield',
      fontVariantNumeric: 'tabular-nums',
    },
    '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
      WebkitAppearance: 'none',
      margin: 0,
    },
  };
});

const Wrapper = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
`;

const TrailSlot = styled.div`
  position: absolute; right: 8px; display: flex; align-items: center;
  pointer-events: none;
  & > * { pointer-events: auto; }
`;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = 'md', monospace, hasError, trailingItems, className, ...rest }, ref) => (
    <Wrapper className={className}>
      <StyledInput ref={ref} $sz={size} $mono={!!monospace} $err={!!hasError} {...rest} />
      {trailingItems && <TrailSlot>{trailingItems}</TrailSlot>}
    </Wrapper>
  )
);
Input.displayName = 'Input';

export default Input;

import React, { useCallback } from 'react';
import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';

interface CheckboxProps {
  checked: boolean | 'indeterminate';
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

const SIZES = { xs: '12px', sm: '16px', md: '22px' } as const;

const bounce = keyframes`
  0% { transform: scale(0.85); }
  40% { transform: scale(1.1); }
  100% { transform: scale(1); }
`;

const FakeBox = styled.div<{ $checked: boolean | 'indeterminate'; $size: keyof typeof SIZES; $disabled?: boolean }>(
  ({ $checked, $size, $disabled }) => {
    const box = SIZES[$size];
    const isOn = $checked === true || $checked === 'indeterminate';
    return {
      width: box, height: box,
      borderRadius: 3,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      cursor: $disabled ? 'not-allowed' : 'pointer',
      opacity: $disabled ? 0.5 : 1,
      border: isOn ? 'none' : '1.5px solid #A29FAA',
      background: isOn ? '#F29964' : '#FFFFFF',
      color: isOn ? '#FFFFFF' : 'transparent',
      transition: 'background 120ms cubic-bezier(0.72, 0, 0.16, 1), border-color 120ms cubic-bezier(0.72, 0, 0.16, 1)',
      ...(isOn ? { animation: `${bounce} 250ms cubic-bezier(0.24, 1, 0.32, 1)` } : {}),
    };
  }
);

const Wrapper = styled.label<{ $size: keyof typeof SIZES; $disabled?: boolean }>(({ $size, $disabled }) => ({
  display: 'inline-flex', alignItems: 'center', gap: 8,
  position: 'relative', lineHeight: SIZES[$size],
  cursor: $disabled ? 'not-allowed' : 'pointer',
  fontFamily: 'inherit',
}));

export function Checkbox({ checked, onChange, disabled, readOnly, size = 'sm' }: CheckboxProps) {
  const isIndeterminate = checked === 'indeterminate';
  const isChecked = checked === true;

  const handleRef = useCallback((el: HTMLInputElement | null) => {
    if (el) el.indeterminate = isIndeterminate;
  }, [isIndeterminate]);

  return (
    <Wrapper $size={size} $disabled={disabled}>
      <FakeBox $checked={checked} $size={size} $disabled={disabled} onClick={() => {
        if (disabled || readOnly) return;
        if (isIndeterminate) onChange?.(true);
        else onChange?.(!isChecked);
      }}>
        <input ref={handleRef} type="checkbox" checked={isChecked} readOnly disabled={disabled}
          style={{ position: 'absolute', width: '100%', height: '100%', top: 0, left: 0, margin: 0, opacity: 0, cursor: 'inherit' }} />
        <svg viewBox="0 0 16 16" width="75%" height="75%" fill="currentColor">
          {isIndeterminate
            ? <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            : isChecked
              ? <path fillRule="evenodd" d="M13.36 4.5a.75.75 0 0 1 .14 1.05l-7 9a.75.75 0 0 1-1.11.07l-3.5-3.5a.75.75 0 0 1 0-1.06l.08-.08a.75.75 0 0 1 .98 0L5.5 12.5l6.3-8.1a.75.75 0 0 1 1.05-.14l.01.01z" clipRule="evenodd" />
              : null}
        </svg>
      </FakeBox>
    </Wrapper>
  );
}

export default Checkbox;

import React from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface } from '../tokens/typography';

const Box = styled.label<{ $checked: boolean; $disabled: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.$disabled ? 0.5 : 1)};
  font-family: ${typeface.body};
  font-size: 14px;
  color: ${semantic.text.primary};
  user-select: none;
`;

const Control = styled.span<{ $checked: boolean }>`
  width: 18px;
  height: 18px;
  border-radius: 6px;
  border: 1.5px solid ${(p) => (p.$checked ? semantic.focus : semantic.border.primary)};
  background: ${(p) => (p.$checked ? semantic.focus : semantic.input.bg)};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 120ms ease, border-color 120ms ease;
  &::after {
    content: '';
    display: ${(p) => (p.$checked ? 'block' : 'none')};
    width: 5px;
    height: 9px;
    border: solid var(--koala-text-on-brand);
    border-width: 0 2px 2px 0;
    transform: rotate(45deg) translateY(-1px);
  }
`;

const Hidden = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode;
}

export default function Checkbox({ label, checked, disabled, className, ...rest }: CheckboxProps) {
  const isChecked = Boolean(checked);
  return (
    <Box className={className} $checked={isChecked} $disabled={Boolean(disabled)}>
      <Hidden type="checkbox" checked={checked} disabled={disabled} {...rest} />
      <Control $checked={isChecked} aria-hidden />
      {label}
    </Box>
  );
}

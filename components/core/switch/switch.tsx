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

const WRAPPER_SIZE = { sm: { width: 36, height: 20 }, lg: { width: 40, height: 24 } } as const;
const KNOB_SIZE = { sm: { width: 20, height: 20 }, lg: { width: 24, height: 24 } } as const;

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
    outline: 2px solid #F29964;
    outline-offset: 2px;
  }

  /* OFF state — debossed neutral track */
  & + div {
    background: #10103008;
    border-top: 2px solid #DAD9DE;
    border-right: 1px solid #DAD9DE;
    border-bottom: 1px solid #DAD9DE;
    border-left: 1px solid #DAD9DE;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);

    [data-icon='checkmark'],
    [data-icon='close'] {
      top: 50%;
      left: 50%;
      position: absolute;
      transform: translate(-50%, -50%);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    > div {
      background: #FFFFFF;
      border: 1px solid #DAD9DE;
      transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      transform: translateY(-2px);
    }
  }

  /* OFF state icon visibility */
  & + div {
    [data-icon='close'] { opacity: 1; transform: scale(1) translate(-50%, -50%); }
    [data-icon='checkmark'] { opacity: 0; transform: scale(0.94) translate(-50%, -50%); }
  }

  /* ON state */
  &:checked + div {
    background: #F29964;
    border-top: 2px solid #C97D52;
    border-right: 1px solid #C97D52;
    border-bottom: 1px solid #C97D52;
    border-left: 1px solid #C97D52;

    [data-icon='close'] { opacity: 0; transform: scale(0.94) translate(-50%, -50%); }
    [data-icon='checkmark'] { opacity: 1; transform: scale(1) translate(-50%, -50%); }

    > div {
      background: #FFFFFF;
      border: 1px solid #C97D52;
      transform: translateY(-2px) translateX(-1px) translateX(${({ $sz }) => WRAPPER_SIZE[$sz].width - KNOB_SIZE[$sz].width + 1}px);
    }
  }

  &:disabled {
    cursor: not-allowed;
    & + div {
      opacity: 0.6;
      > div { transform: translateY(0px) translateX(-1px); }
    }
    &:checked + div > div {
      transform: translateY(0px) translateX(${({ $sz }) => WRAPPER_SIZE[$sz].width - KNOB_SIZE[$sz].width + 1}px);
    }
  }
`;

const Track = styled.div<{ $sz: NonNullable<SwitchProps['size']> }>(({ $sz }) => ({
  position: 'relative',
  width: WRAPPER_SIZE[$sz].width,
  height: WRAPPER_SIZE[$sz].height,
  borderRadius: 5,
  pointerEvents: 'none',
  display: 'inline-flex',
  flexShrink: 0,
}));

const Knob = styled.div<{ $sz: NonNullable<SwitchProps['size']> }>(({ $sz }) => ({
  position: 'absolute',
  top: 0, left: 0, right: 0, bottom: 0,
  width: KNOB_SIZE[$sz].width,
  height: KNOB_SIZE[$sz].height,
  borderRadius: 5,
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
        <Knob $sz={size}>
          <svg data-icon="close" viewBox="0 0 16 16" width={size === 'sm' ? 10 : 12} height={size === 'sm' ? 10 : 12} fill="none">
            <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="#A29FAA" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <svg data-icon="checkmark" viewBox="0 0 16 16" width={size === 'sm' ? 10 : 12} height={size === 'sm' ? 10 : 12} fill="none">
            <path d="M4 8l2.5 3L12 5" stroke="#F29964" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Knob>
      </Track>
    </div>
  );
}

export default Switch;

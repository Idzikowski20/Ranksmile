import React from 'react';
import { Button as CoreButton } from '../core/button/button';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const VARIANT_MAP: Record<ButtonVariant, 'primary' | 'secondary' | 'transparent'> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'transparent',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const Button = ({ variant = 'primary', children, disabled, style, className, ...rest }: ButtonProps) => {
  return (
    <CoreButton
      variant={VARIANT_MAP[variant]}
      disabled={disabled}
      size="md"
      {...rest as Record<string, unknown>}
    >
      {children}
    </CoreButton>
  );
};

export default Button;

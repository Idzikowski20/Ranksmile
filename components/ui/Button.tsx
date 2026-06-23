import React, { useState } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

// Values per DESIGN.md §8. Hover is handled internally so consumers don't repeat it
// (inline styles can't express :hover).
const VARIANTS: Record<ButtonVariant, { bg: string; color: string; hoverBg: string; radius: number; shadow?: string }> = {
  primary: { bg: '#2F2F34', color: '#FFFFFF', hoverBg: '#783AFB', radius: 6 },
  secondary: { bg: '#F4F4F5', color: '#2F2F34', hoverBg: '#E4E4E7', radius: 6 },
  ghost: { bg: 'transparent', color: '#3F3F47', hoverBg: '#F4F4F5', radius: 8, shadow: 'inset 0 0 0 1px #E4E4E7' },
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const Button = ({ variant = 'primary', children, disabled, style, onMouseEnter, onMouseLeave, ...rest }: ButtonProps) => {
  const [hover, setHover] = useState(false);
  const v = VARIANTS[variant];
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={(e) => { setHover(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHover(false); onMouseLeave?.(e); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '6px 16px',
        border: 'none',
        borderRadius: v.radius,
        boxShadow: v.shadow,
        fontFamily: 'var(--font-family-primary)',
        fontSize: 14,
        fontWeight: 600,
        background: !disabled && hover ? v.hoverBg : v.bg,
        color: v.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.15s',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};

export default Button;

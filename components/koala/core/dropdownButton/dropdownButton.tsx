import React from 'react';
import { Button } from '../button/button';
import type { ButtonProps } from '../button/types';

export type DropdownButtonProps = Omit<ButtonProps, 'type' | 'children' | 'prefix'> & {
  isOpen?: boolean;
  prefix?: React.ReactNode;
  showChevron?: boolean;
  children?: React.ReactNode;
};

const Chevron = ({ up, size }: { up: boolean; size: ButtonProps['size'] }) => (
  <svg
    viewBox="0 0 20 20"
    width={size === 'xs' || size === 'zero' ? 14 : 16}
    height={size === 'xs' || size === 'zero' ? 14 : 16}
    fill="currentColor"
    aria-hidden="true"
    style={{
      flexShrink: 0,
      transform: up ? 'rotate(180deg)' : 'none',
      transition: 'transform 150ms ease',
      color: '#6A6772',
    }}
  >
    <path
      fillRule="evenodd"
      d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06"
      clipRule="evenodd"
    />
  </svg>
);

export function DropdownButton({
  children,
  prefix,
  size = 'sm',
  isOpen = false,
  showChevron = true,
  disabled = false,
  variant = 'secondary',
  style,
  ...props
}: DropdownButtonProps) {
  return (
    <Button
      {...props}
      type="button"
      variant={variant}
      size={size}
      disabled={disabled}
      aria-haspopup="true"
      aria-expanded={isOpen}
      style={{
        position: 'relative',
        maxWidth: '100%',
        width: '100%',
        justifyContent: 'flex-start',
        fontWeight: prefix ? 400 : undefined,
        boxShadow: isOpen || disabled ? 'none' : undefined,
        ...style,
      }}
    >
      {prefix && (
        <span className="koala-dropdown-button-prefix">{prefix}</span>
      )}
      <span className="koala-dropdown-button-label">{children}</span>
      {showChevron && (
        <span className="koala-dropdown-button-chevron">
          <Chevron up={isOpen} size={size} />
        </span>
      )}
    </Button>
  );
}

export default DropdownButton;

import React, { forwardRef } from 'react';

type StatusIndicatorVariant = 'accent' | 'danger' | 'warning' | 'success' | 'promotion' | 'muted';

type StatusIndicatorProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant: StatusIndicatorVariant;
  animate?: boolean;
};

const StatusIndicator = forwardRef<HTMLSpanElement, StatusIndicatorProps>(
  ({ variant, animate = true, className = '', 'aria-label': ariaLabel, role, ...rest }, ref) => (
    <span
      ref={ref}
      role={role ?? (ariaLabel ? 'img' : undefined)}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel && !role ? true : undefined}
      className={`koala-status-indicator koala-status-indicator--${variant} ${animate ? 'koala-status-indicator--animate' : ''} ${className}`}
      {...rest}
    />
  )
);
StatusIndicator.displayName = 'StatusIndicator';
export default StatusIndicator;

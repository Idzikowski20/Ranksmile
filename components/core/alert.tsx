import React, { forwardRef } from 'react';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
};

/** Inline SVG icons — stroke style, matches Sentry shell iconography. */
const AlertIcon = ({ variant }: { variant: AlertVariant }) => {
  if (variant === 'success') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6.5 10.25l2.25 2.25L13.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (variant === 'warning') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 3.5L17.5 16.5H2.5L10 3.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M10 8v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="10" cy="14.25" r="0.75" fill="currentColor" />
      </svg>
    );
  }
  if (variant === 'error') {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 9v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.75" r="0.75" fill="currentColor" />
    </svg>
  );
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, children, className = '', ...rest }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={`sentry-alert sentry-alert--${variant} ${className}`}
      {...rest}
    >
      <span className="sentry-alert-icon" aria-hidden="true">
        <AlertIcon variant={variant} />
      </span>
      <div className="sentry-alert-body">
        {title && <div className="sentry-alert-title">{title}</div>}
        {children && <div className="sentry-alert-message">{children}</div>}
      </div>
    </div>
  ),
);
Alert.displayName = 'Alert';
export default Alert;

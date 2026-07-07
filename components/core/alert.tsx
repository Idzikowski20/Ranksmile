import React, { forwardRef } from 'react';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
};

const VARIANT_ICON: Record<AlertVariant, string> = {
  success: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, children, className = '', ...rest }, ref) => {
    const iconPath = VARIANT_ICON[variant];
    return (
      <div
        ref={ref}
        role="alert"
        className={`sentry-alert sentry-alert--${variant} ${className}`}
        {...rest}
      >
        <span className="sentry-alert-icon" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d={iconPath} />
          </svg>
        </span>
        <div className="sentry-alert-body">
          {title && <div className="sentry-alert-title">{title}</div>}
          {children && <div className="sentry-alert-message">{children}</div>}
        </div>
      </div>
    );
  }
);
Alert.displayName = 'Alert';
export default Alert;

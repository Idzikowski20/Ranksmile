import React, { forwardRef } from 'react';
import { Icon } from '../icons/Icon';

type AlertVariant = 'success' | 'warning' | 'error' | 'info';

type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: AlertVariant;
  title?: string;
  children?: React.ReactNode;
};

const ALERT_ICON: Record<AlertVariant, string> = {
  success: 'CheckCircle',
  warning: 'Warning',
  error: 'XCircle',
  info: 'Info',
};

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ variant = 'info', title, children, className = '', ...rest }, ref) => (
    <div
      ref={ref}
      role="alert"
      className={`koala-alert koala-alert--${variant} ${className}`}
      {...rest}
    >
      <span className="koala-alert-icon" aria-hidden="true">
        <Icon name={ALERT_ICON[variant]} size={20} weight="fill" />
      </span>
      <div className="koala-alert-body">
        {title && <div className="koala-alert-title">{title}</div>}
        {children && <div className="koala-alert-message">{children}</div>}
      </div>
    </div>
  ),
);
Alert.displayName = 'Alert';
export default Alert;

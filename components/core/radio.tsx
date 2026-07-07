import React, { forwardRef, useId } from 'react';

type RadioProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: string;
  description?: string;
};

const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ label, description, className = '', id, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <label className={`sentry-radio ${className}`} htmlFor={inputId}>
        <input ref={ref} id={inputId} type="radio" className="sentry-radio-input" {...rest} />
        <span className="sentry-radio-control" aria-hidden="true">
          <span className="sentry-radio-dot" />
        </span>
        {(label || description) && (
          <span className="sentry-radio-label">
            {label && <span className="sentry-radio-label-text">{label}</span>}
            {description && <span className="sentry-radio-label-desc">{description}</span>}
          </span>
        )}
      </label>
    );
  },
);
Radio.displayName = 'Radio';
export default Radio;

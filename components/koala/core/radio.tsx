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
      <label className={`koala-radio ${className}`} htmlFor={inputId}>
        <input ref={ref} id={inputId} type="radio" className="koala-radio-input" {...rest} />
        <span className="koala-radio-control" aria-hidden="true">
          <span className="koala-radio-dot" />
        </span>
        {(label || description) && (
          <span className="koala-radio-label">
            {label && <span className="koala-radio-label-text">{label}</span>}
            {description && <span className="koala-radio-label-desc">{description}</span>}
          </span>
        )}
      </label>
    );
  },
);
Radio.displayName = 'Radio';
export default Radio;

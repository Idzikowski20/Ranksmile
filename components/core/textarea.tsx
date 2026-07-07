import React, { forwardRef, useCallback, useId } from 'react';

type TextareaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'resize'> & {
  label?: string;
  description?: string;
  error?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  maxLength?: number;
};

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, description, error, resize = 'vertical', maxLength, className = '', id, onChange, ...rest }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (maxLength != null && e.target.value.length > maxLength) {
          e.target.value = e.target.value.slice(0, maxLength);
        }
        onChange?.(e);
      },
      [maxLength, onChange],
    );
    return (
      <div className={`sentry-textarea ${className}`}>
        {(label || description) && (
          <div className="sentry-textarea-header">
            {label && <label htmlFor={inputId} className="sentry-textarea-label">{label}</label>}
            {description && <span className="sentry-textarea-desc">{description}</span>}
          </div>
        )}
        <textarea
          ref={ref}
          id={inputId}
          maxLength={maxLength}
          className="sentry-textarea-input"
          style={{ resize }}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : (description ? `${inputId}-desc` : undefined)}
          {...rest}
          onChange={handleChange}
        />
        {error && (
          <p id={`${inputId}-error`} className="sentry-textarea-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
export default Textarea;

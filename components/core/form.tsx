import React, { forwardRef, useId } from 'react';

type FormFieldProps = {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
};

export function FormField({
  label,
  hint,
  error,
  required,
  children,
  className = '',
  htmlFor,
}: FormFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`sentry-form-field ${className}`}>
      {label && (
        <label htmlFor={fieldId} className="sentry-form-label">
          {label}
          {required && <span className="sentry-form-required" aria-hidden="true"> *</span>}
        </label>
      )}
      <div className="sentry-form-control" data-describedby={describedBy}>
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
              id: fieldId,
              'aria-describedby': describedBy,
              'aria-invalid': error ? true : undefined,
            })
          : children}
      </div>
      {hint && !error && (
        <p id={hintId} className="sentry-form-hint">{hint}</p>
      )}
      {error && (
        <p id={errorId} className="sentry-form-error" role="alert">{error}</p>
      )}
    </div>
  );
}

type FormProps = React.FormHTMLAttributes<HTMLFormElement>;

export const Form = forwardRef<HTMLFormElement, FormProps>(
  ({ className = '', children, ...rest }, ref) => (
    <form ref={ref} className={`sentry-form ${className}`} {...rest}>
      {children}
    </form>
  )
);
Form.displayName = 'Form';

export default FormField;

import React, { forwardRef, useId } from 'react';
import styled from '@emotion/styled';
import { semantic } from '../tokens/semantic';
import { typeface, textScale, fontWeight } from '../tokens/typography';
import { spacing } from '../tokens/spacing';

const FieldRoot = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.sm};
  font-family: ${typeface.body};
`;

const Label = styled.label`
  font-size: ${textScale.sm.fontSize};
  line-height: ${textScale.sm.lineHeight};
  font-weight: ${fontWeight.medium};
  color: ${semantic.text.primary};
  letter-spacing: ${textScale.sm.letterSpacing};
`;

const RequiredMark = styled.span`
  color: ${semantic.text.brand};
`;

const Control = styled.div`
  display: flex;
  flex-direction: column;
`;

const Meta = styled.p`
  margin: 0;
  font-size: ${textScale.xs.fontSize};
  line-height: ${textScale.xs.lineHeight};
  letter-spacing: ${textScale.xs.letterSpacing};
`;

const Hint = styled(Meta)`
  color: ${semantic.text.secondary};
`;

const Description = styled(Meta)`
  color: ${semantic.text.tertiary};
`;

const ErrorText = styled(Meta)`
  color: ${semantic.status.danger};
`;

const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const Section = styled.fieldset`
  margin: 0;
  padding: 0;
  border: none;
  display: flex;
  flex-direction: column;
  gap: ${spacing.xl};
`;

const SectionLegend = styled.legend`
  padding: 0;
  margin: 0 0 ${spacing.lg};
  font-size: ${textScale.base.fontSize};
  line-height: ${textScale.base.lineHeight};
  font-weight: ${fontWeight.bold};
  color: ${semantic.text.primary};
  letter-spacing: ${textScale.base.letterSpacing};
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${spacing.lg};
  margin-top: ${spacing['2xl']};
`;

const FormRoot = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${spacing['2xl']};
  font-family: ${typeface.body};
`;

/* —— Atomic field pieces —— */

export type FieldLabelProps = {
  children: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  className?: string;
};

export function FieldLabel({ children, htmlFor, required, className }: FieldLabelProps) {
  return (
    <Label htmlFor={htmlFor} className={`koala-field-label ${className ?? ''}`.trim()}>
      {children}
      {required ? <RequiredMark aria-hidden="true"> *</RequiredMark> : null}
    </Label>
  );
}

export type FieldDescriptionProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
};

export function FieldDescription({ children, id, className }: FieldDescriptionProps) {
  return (
    <Description id={id} className={`koala-field-description ${className ?? ''}`.trim()}>
      {children}
    </Description>
  );
}

export type FieldHintProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
};

export function FieldHint({ children, id, className }: FieldHintProps) {
  return (
    <Hint id={id} className={`koala-field-hint koala-form-hint ${className ?? ''}`.trim()}>
      {children}
    </Hint>
  );
}

/** @deprecated Prefer FieldHint */
export const HelperText = FieldHint;
export type HelperTextProps = FieldHintProps;

export type FieldErrorProps = {
  children: React.ReactNode;
  id?: string;
  className?: string;
};

export function FieldError({ children, id, className }: FieldErrorProps) {
  return (
    <ErrorText id={id} role="alert" className={`koala-field-error koala-form-error ${className ?? ''}`.trim()}>
      {children}
    </ErrorText>
  );
}

/** @deprecated Prefer FieldError */
export const ValidationMessage = FieldError;
export type ValidationMessageProps = FieldErrorProps;

/* —— FormField (composed) —— */

export type FormFieldProps = {
  label?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  /** Alias for description (legacy). */
  helperText?: React.ReactNode;
  /** Alias for description (core FormField). */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  className?: string;
  htmlFor?: string;
};

export function FormField({
  label,
  children,
  description,
  helperText,
  hint,
  error,
  required,
  className,
  htmlFor,
}: FormFieldProps) {
  const autoId = useId();
  const fieldId = htmlFor ?? autoId;
  const desc = description ?? helperText ?? hint;
  const hintId = desc && !error ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldRoot className={`koala-form-field koala-form-field ${className ?? ''}`.trim()}>
      {label ? (
        <FieldLabel htmlFor={fieldId} required={required}>
          {label}
        </FieldLabel>
      ) : null}
      <Control className="koala-form-control">
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
              id: fieldId,
              'aria-describedby': describedBy,
              'aria-invalid': error ? true : undefined,
            })
          : children}
      </Control>
      {desc && !error ? <FieldHint id={hintId}>{desc}</FieldHint> : null}
      {error ? <FieldError id={errorId}>{error}</FieldError> : null}
    </FieldRoot>
  );
}

/** @deprecated Prefer FormField — same API */
export const Field = FormField;
export type FieldProps = FormFieldProps;

export type FieldGroupProps = {
  children: React.ReactNode;
  className?: string;
};

export function FieldGroup({ children, className }: FieldGroupProps) {
  return <Group className={className}>{children}</Group>;
}

export type FormSectionProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <Section className={`koala-form-section ${className ?? ''}`.trim()}>
      {title ? <SectionLegend>{title}</SectionLegend> : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {children}
    </Section>
  );
}

export type FormActionsProps = {
  children: React.ReactNode;
  className?: string;
};

export function FormActions({ children, className }: FormActionsProps) {
  return <Actions className={`koala-form-actions ${className ?? ''}`.trim()}>{children}</Actions>;
}

export type FormProps = React.FormHTMLAttributes<HTMLFormElement>;

export const Form = forwardRef<HTMLFormElement, FormProps>(
  ({ className = '', children, ...rest }, ref) => (
    <FormRoot ref={ref} className={`koala-form koala-form ${className}`.trim()} {...rest}>
      {children}
    </FormRoot>
  ),
);
Form.displayName = 'Form';

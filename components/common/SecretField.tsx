import React from 'react';
import Input from '../koala/primitives/Input';
import { FormField } from '../koala/forms';

/**
 * @deprecated Prefer FormField + Input with `revealable`.
 * Delete after Phase 3 Koala redesign wave.
 */
type SecretFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  classNames?: string;
  hasError?: boolean;
};

const SecretField = ({ label = '', value = '', placeholder = '', onChange, hasError = false, classNames = '' }: SecretFieldProps) => (
  <FormField label={label} className={`koala-secret-field ${classNames}`} error={hasError ? ' ' : undefined}>
    <Input
      size="sm"
      type="password"
      revealable
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      hasError={hasError}
      style={{ width: 210 }}
    />
  </FormField>
);

export default SecretField;

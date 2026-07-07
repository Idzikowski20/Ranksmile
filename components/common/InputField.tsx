import React from 'react';
import Input from '../core/input/input';
import { FormField } from '../core/form';

type InputFieldProps = {
   label: string;
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   classNames?: string;
   hasError?: boolean;
};

const InputField = ({ label = '', value = '', placeholder = '', onChange, hasError = false, classNames = '' }: InputFieldProps) => (
   <FormField label={label} error={hasError ? ' ' : undefined} className={classNames}>
      <Input
         size="sm"
         value={value}
         onChange={(e) => onChange(e.target.value)}
         placeholder={placeholder}
         hasError={hasError}
         style={{ width: 210 }}
      />
   </FormField>
);

export default InputField;

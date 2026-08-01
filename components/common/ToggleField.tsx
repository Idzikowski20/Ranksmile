import React from 'react';
import { Switch } from '../koala/core/switch/switch';
import { FormField } from '../koala/core/form';

type ToggleFieldProps = {
   label: string;
   value: boolean;
   onChange: (bool: boolean) => void;
   classNames?: string;
};

const ToggleField = ({ label = '', value = false, onChange, classNames = '' }: ToggleFieldProps) => (
   <FormField label={label} className={classNames}>
      <div className="koala-toggle-field-row">
         <Switch checked={!!value} onChange={(v) => onChange(v)} size="lg" />
      </div>
   </FormField>
);

export default ToggleField;

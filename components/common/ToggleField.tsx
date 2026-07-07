import React from 'react';
import { Switch } from '../core/switch/switch';
import { FormField } from '../core/form';

type ToggleFieldProps = {
   label: string;
   value: boolean;
   onChange: (bool: boolean) => void;
   classNames?: string;
};

const ToggleField = ({ label = '', value = false, onChange, classNames = '' }: ToggleFieldProps) => (
   <FormField label={label} className={classNames}>
      <div className="sentry-toggle-field-row">
         <Switch checked={!!value} onChange={(v) => onChange(v)} size="lg" />
      </div>
   </FormField>
);

export default ToggleField;

import React from 'react';
import { Switch } from '../core/switch/switch';

type ToggleFieldProps = {
   label: string;
   value: boolean;
   onChange: (bool: boolean) => void;
   classNames?: string;
};

const ToggleField = ({ label = '', value = false, onChange, classNames = '' }: ToggleFieldProps) => {
   return (
      <div className={`field--toggle w-full relative ${classNames}`}>
         <label className="relative inline-flex items-center cursor-pointer w-full justify-between">
            <span className="text-sm font-medium text-gray-700 w-auto">{label}</span>
            <Switch
               checked={!!value}
               onChange={(v) => onChange(v)}
               size="lg"
            />
         </label>
      </div>
   );
};

export default ToggleField;

import React, { useId } from 'react';
import { Input } from '../core/input/input';

type InputFieldProps = {
   label: string;
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   classNames?: string;
   hasError?: boolean;
};

const InputField = ({ label = '', value = '', placeholder = '', onChange, hasError = false, classNames = '' }: InputFieldProps) => {
   const id = useId();
   return (
      <div className={`field--input w-full relative flex justify-between items-center ${classNames}`}>
         <label htmlFor={id} className="font-semibold inline-block text-sm text-gray-700 capitalize">
            {label}
         </label>
         <Input
            id={id}
            size="sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            hasError={hasError}
            style={{ width: 210 }}
         />
      </div>
   );
};

export default InputField;

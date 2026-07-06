import React, { useState, useId } from 'react';
import Icon from './Icon';
import { Input } from '../core/input/input';

type SecretFieldProps = {
   label: string;
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   classNames?: string;
   hasError?: boolean;
};

const SecretField = ({ label = '', value = '', placeholder = '', onChange, hasError = false, classNames = '' }: SecretFieldProps) => {
   const [showValue, setShowValue] = useState(false);
   const id = useId();
   return (
      <div className={`settings__section__secret w-full relative flex justify-between items-center ${classNames}`}>
         <label htmlFor={id} className="mb-2 font-semibold inline-block text-sm text-gray-700 capitalize">
            {label}
         </label>
         <span
            className="absolute top-1 right-0 px-2 py-1 cursor-pointer text-gray-400 select-none z-10"
            onClick={() => setShowValue(!showValue)}
         >
            <Icon type={showValue ? 'eye-closed' : 'eye'} size={18} />
         </span>
         <Input
            id={id}
            size="sm"
            type={showValue ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            hasError={hasError}
            style={{ width: 210 }}
         />
      </div>
   );
};

export default SecretField;

import React, { useState } from 'react';
import Input from '../core/input/input';
import { FormField } from '../core/form';

type SecretFieldProps = {
   label: string;
   value: string;
   onChange: (value: string) => void;
   placeholder?: string;
   classNames?: string;
   hasError?: boolean;
};

const EyeIcon = ({ closed }: { closed?: boolean }) => (
   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {closed ? (
         <path d="M3 3l18 18M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58M9.88 5.09A10.94 10.94 0 0 1 12 5c7 0 10 7 10 7a18.45 18.45 0 0 1-2.16 3.19M6.12 6.12A18.5 18.5 0 0 0 2 12s3 7 10 7a10.66 10.66 0 0 0 5.09-1.26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      ) : (
         <>
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
         </>
      )}
   </svg>
);

const SecretField = ({ label = '', value = '', placeholder = '', onChange, hasError = false, classNames = '' }: SecretFieldProps) => {
   const [showValue, setShowValue] = useState(false);
   return (
      <FormField label={label} className={`sentry-secret-field ${classNames}`} error={hasError ? ' ' : undefined}>
         <div className="sentry-secret-field-wrap">
            <Input
               size="sm"
               type={showValue ? 'text' : 'password'}
               value={value}
               onChange={(e) => onChange(e.target.value)}
               placeholder={placeholder}
               hasError={hasError}
               style={{ width: 210, paddingRight: 36 }}
            />
            <button type="button" className="sentry-secret-toggle" aria-label={showValue ? 'Hide' : 'Show'} onClick={() => setShowValue(!showValue)}>
               <EyeIcon closed={showValue} />
            </button>
         </div>
      </FormField>
   );
};

export default SecretField;

import React from 'react';
import { Checkbox as CoreCheckbox } from '../core/checkbox/checkbox';

const Checkbox = ({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate?: boolean; onChange: () => void;
}) => (
  <CoreCheckbox
    checked={indeterminate && !checked ? 'indeterminate' : checked}
    onChange={() => onChange()}
    size="sm"
  />
);

export default Checkbox;

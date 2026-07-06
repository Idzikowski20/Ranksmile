import React from 'react';
import { Switch } from '../core/switch/switch';

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <Switch checked={checked} onChange={() => onChange()} size="sm" />
);

export default Toggle;

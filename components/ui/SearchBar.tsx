import React from 'react';
import { Input } from '../core/input/input';
import { SearchIcon } from './icons';

const SearchBar = ({ value, onChange, placeholder = 'Search', width = 250 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string;
}) => (
  <div style={{ position: 'relative', width }}>
    <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#3F3F47', pointerEvents: 'none', display: 'flex', zIndex: 1 }}>
      <SearchIcon size={16} />
    </div>
    <Input
      size="sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ paddingLeft: 30 }}
    />
  </div>
);

export default SearchBar;

import React from 'react';
import { SearchIcon } from './icons';

const SearchBar = ({ value, onChange, placeholder = 'Search', width = 250 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string;
}) => (
  <div style={{ position: 'relative', width }}>
    <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#3F3F47', pointerEvents: 'none', display: 'flex' }}>
      <SearchIcon size={16} />
    </div>
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%', height: 32,
        paddingLeft: 30, paddingRight: 12,
        border: '1px solid #E4E4E7',
        borderRadius: 6,
        fontSize: 13, color: '#09090B',
        background: '#fff', outline: 'none',
        fontFamily: 'var(--font-family-primary)',
        boxShadow: '0px 1px 2px rgba(26,29,40,0.06)',
      }}
    />
  </div>
);

export default SearchBar;

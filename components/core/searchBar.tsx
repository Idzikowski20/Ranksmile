import React from 'react';
import Input from './input/input';

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 21l-4.35-4.35M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const SearchBar = ({ value, onChange, placeholder = 'Search', width = 250 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; width?: number | string;
}) => (
  <div className="sentry-search-bar" style={{ width }}>
    <span className="sentry-search-bar-icon" aria-hidden="true"><SearchIcon /></span>
    <Input
      size="sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ paddingLeft: 30, width: '100%' }}
    />
  </div>
);

export default SearchBar;

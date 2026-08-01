import React from 'react';
import Input from '../primitives/Input';
import { Icon } from '../icons/Icon';

/**
 * SearchBar — Input + leading search icon (Koala).
 */
const SearchBar = ({
  value,
  onChange,
  placeholder = 'Search',
  width = 250,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number | string;
}) => (
  <div className="koala-search-bar" style={{ width }}>
    <Input
      size="sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      leadingItems={<Icon name="MagnifyingGlass" size={16} weight="bold" />}
      style={{ width: '100%' }}
    />
  </div>
);

export default SearchBar;

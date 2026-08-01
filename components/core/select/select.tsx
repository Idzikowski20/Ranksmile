import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';

export interface SelectOption { value: string; label: string; }

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  size?: 'sm' | 'md';
  width?: number | string;
  emptyMessage?: string;
  renderOption?: (option: SelectOption, selected: boolean) => React.ReactNode;
}

const FORM: Record<string, { h: string; fs: string; pl: number; pr: number; r: string }> = {
  sm: { h: '32px', fs: '0.875rem', pl: 12, pr: 28, r: '6px' },
  md: { h: '36px', fs: '0.875rem', pl: 16, pr: 32, r: '8px' },
};

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const Trigger = styled.button<{ $sz: 'sm' | 'md'; $open: boolean }>(({ $sz, $open }) => {
  const cfg = FORM[$sz];
  return {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: cfg.h,
    padding: `0 ${cfg.pr}px 0 ${cfg.pl}px`,
    fontSize: cfg.fs,
    fontFamily: "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif",
    fontWeight: 400,
    lineHeight: '1rem',
    borderRadius: cfg.r,
    // Open: single accent border + soft glow (NOT border+hard ring — that reads as double border).
    border: $open ? '1px solid #F29964' : '1px solid #dbded4',
    backgroundColor: '#FFFFFF',
    color: '#302E36',
    boxShadow: $open ? '0 0 0 3px rgba(242, 153, 100, 0.18)' : 'none',
    cursor: 'pointer',
    outline: 'none',
    textAlign: 'left' as const,
    transition: 'border 0.12s cubic-bezier(0.72, 0, 0.16, 1), box-shadow 0.12s cubic-bezier(0.72, 0, 0.16, 1)',
    '&:hover': { borderColor: $open ? '#F29964' : '#A29FAA' },
  };
});

const ChevronWrap = styled.span<{ $open: boolean }>(({ $open }) => ({
  position: 'absolute', right: 8, top: '50%',
  transform: $open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
  transition: 'transform 0.12s ease',
  display: 'inline-flex', color: '#6A6772', pointerEvents: 'none',
}));

const Label = styled.span`
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: block;
`;

const Menu = styled.div`
  position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 200;
  background: #FFFFFF; border: 1px solid #E6E6E9; border-radius: 8px;
  box-shadow: 0px 18px 40px rgba(17,24,39,0.14), 0px 8px 18px rgba(17,24,39,0.09), 0px 2px 6px rgba(17,24,39,0.06);
  overflow: hidden;
`;

const SearchWrap = styled.div`
  padding: 6px 8px; border-bottom: 1px solid #E6E6E9;
`;

const SearchInp = styled.input`
  width: 100%; height: 30px; padding: 0 8px;
  border: 1px solid #dbded4; border-radius: 5px;
  font-size: 14px; font-family: inherit; color: #302E36; background: #FFFFFF;
  outline: none;
  &::placeholder { color: #6A6772; }
  &:focus { border-color: #F29964; box-shadow: 0 0 0 3px rgba(242, 153, 100, 0.18); }
`;

const List = styled.div`
  max-height: 220px; overflow-y: auto; padding: 4px;
`;

const Opt = styled.button<{ $sel: boolean }>(({ $sel }) => ({
  display: 'flex', width: '100%', alignItems: 'center', gap: 10,
  border: 'none', borderRadius: 6,
  background: $sel ? '#F0F0F2' : 'transparent',
  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', color: '#302E36',
  cursor: 'pointer', textAlign: 'left' as const,
  '&:hover': { background: $sel ? '#F0F0F2' : '#f3f4f0' },
}));

const Emp = styled.div`
  padding: 16px; textAlign: center; fontSize: 13px; color: #878490;
`;

const CK = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="#F5A978" style={{ flexShrink: 0, marginLeft: 'auto' }}>
    <path fillRule="evenodd" d="M13.36 4.5a.75.75 0 0 1 .14 1.05l-7 9a.75.75 0 0 1-1.11.07l-3.5-3.5a.75.75 0 0 1 0-1.06l.08-.08a.75.75 0 0 1 .98 0L5.5 12.5l6.3-8.1a.75.75 0 0 1 1.05-.14l.01.01z" clipRule="evenodd" />
  </svg>
);

export function Select({
  options, value, onChange, placeholder = 'Select...',
  searchable = false, size = 'sm', width, emptyMessage = 'No results', renderOption,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onMouse); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <Wrapper ref={wrapRef} style={{ width }}>
      <div style={{ position: 'relative' }}>
        <Trigger $sz={size} $open={open} ref={triggerRef}
          onClick={() => { setOpen(!open); if (open) setSearch(''); }}>
          <Label>{selected ? selected.label : <span style={{ color: '#6A6772' }}>{placeholder}</span>}</Label>
        </Trigger>
        <ChevronWrap $open={open}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
          </svg>
        </ChevronWrap>
      </div>
      {open && (
        <Menu>
          {searchable && (
            <SearchWrap>
              <SearchInp autoFocus placeholder="Search..." value={search}
                onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} />
            </SearchWrap>
          )}
          <List>
            {filtered.length === 0 ? <Emp>{emptyMessage}</Emp> : filtered.map((opt) => (
              <Opt key={opt.value} $sel={opt.value === value}
                onClick={() => { onChange(opt.value); setOpen(false); setSearch(''); }}>
                {renderOption ? renderOption(opt, opt.value === value) : (
                  <>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                    {opt.value === value && <CK />}
                  </>
                )}
              </Opt>
            ))}
          </List>
        </Menu>
      )}
    </Wrapper>
  );
}

export default Select;

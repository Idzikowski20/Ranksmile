import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from '@emotion/styled';
import { FLOATING_MENU_Z, useAnchoredPosition } from '../useAnchoredPosition';
import { semantic } from '../../tokens/semantic';
import { typeface } from '../../tokens/typography';

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
  disabled?: boolean;
  renderOption?: (option: SelectOption, selected: boolean) => React.ReactNode;
}

const FORM: Record<string, { h: string; fs: string; pl: number; pr: number; r: string }> = {
  sm: { h: '32px', fs: '0.875rem', pl: 12, pr: 28, r: '10px' },
  md: { h: '40px', fs: '0.875rem', pl: 12, pr: 32, r: '12px' },
};

const Wrapper = styled.div`
  position: relative;
  display: inline-block;
`;

const Trigger = styled.button<{ $sz: 'sm' | 'md'; $open: boolean; $disabled?: boolean }>(({ $sz, $open, $disabled }) => {
  const cfg = FORM[$sz];
  return {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    height: cfg.h,
    padding: `0 ${cfg.pr}px 0 ${cfg.pl}px`,
    fontSize: cfg.fs,
    fontFamily: typeface.body,
    fontWeight: 400,
    lineHeight: '1rem',
    borderRadius: cfg.r,
    border: $open ? `1px solid ${semantic.input.borderFocus}` : `1px solid ${semantic.input.border}`,
    backgroundColor: $disabled ? semantic.background.secondary : semantic.input.bg,
    color: semantic.text.primary,
    boxShadow: $open ? 'var(--shadow-focus)' : 'none',
    cursor: $disabled ? 'not-allowed' : 'var(--koala-cursor-pointing)',
    opacity: $disabled ? 0.5 : 1,
    outline: 'none',
    textAlign: 'left' as const,
    transition: 'border 0.12s ease, box-shadow 0.12s ease',
    '&:hover': $disabled ? undefined : { borderColor: $open ? semantic.input.borderFocus : semantic.input.borderHover },
    '&:focus-visible': {
      borderColor: semantic.input.borderFocus,
      boxShadow: 'var(--shadow-focus)',
    },
  };
});

const ChevronWrap = styled.span<{ $open: boolean }>(({ $open }) => ({
  position: 'absolute', right: 8, top: '50%',
  transform: $open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%)',
  transition: 'transform 0.12s ease',
  display: 'inline-flex', color: semantic.text.secondary, pointerEvents: 'none',
}));

const Label = styled.span`
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  display: block;
`;

/**
 * Portalled to <body> and fixed against the trigger, so an `overflow` ancestor (a modal
 * body, a scroll panel) can't clip it or grow a scrollbar around it. Above the modal
 * overlay (10000).
 */
const Menu = styled.div`
  position: fixed; z-index: ${FLOATING_MENU_Z};
  background: ${semantic.card.bg};
  border: 1px solid ${semantic.card.border};
  border-radius: 16px;
  box-shadow: var(--shadow-2);
  overflow: hidden;
  padding: 4px;
`;

const SearchWrap = styled.div`
  padding: 6px 8px;
  border-bottom: 1px solid ${semantic.border.primary};
`;

const SearchInp = styled.input`
  width: 100%; height: 30px; padding: 0 8px;
  border: 1px solid ${semantic.input.border};
  border-radius: 5px;
  font-size: 14px; font-family: inherit;
  color: ${semantic.text.primary};
  background: ${semantic.input.bg};
  outline: none;
  &::placeholder { color: ${semantic.input.placeholder}; }
  &:focus { border-color: ${semantic.input.borderFocus}; box-shadow: var(--shadow-focus); }
`;

const List = styled.div`
  max-height: 220px; overflow-y: auto; padding: 4px;
`;

const Opt = styled.button<{ $sel: boolean }>(({ $sel }) => ({
  display: 'flex', width: '100%', alignItems: 'center', gap: 10,
  border: 'none', borderRadius: 6,
  background: $sel ? semantic.background.secondary : 'transparent',
  padding: '8px 12px', fontSize: 14, fontFamily: 'inherit', color: semantic.text.primary,
  cursor: 'var(--koala-cursor-pointing)', textAlign: 'left' as const,
  '&:hover': { background: semantic.background.secondary },
}));

const Emp = styled.div`
  padding: 16px; text-align: center; font-size: 13px; color: ${semantic.text.tertiary};
`;

const CK = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="var(--koala-brand)" style={{ flexShrink: 0, marginLeft: 'auto' }}>
    <path fillRule="evenodd" d="M13.36 4.5a.75.75 0 0 1 .14 1.05l-7 9a.75.75 0 0 1-1.11.07l-3.5-3.5a.75.75 0 0 1 0-1.06l.08-.08a.75.75 0 0 1 .98 0L5.5 12.5l6.3-8.1a.75.75 0 0 1 1.05-.14l.01.01z" clipRule="evenodd" />
  </svg>
);

export function Select({
  options, value, onChange, placeholder = 'Select...',
  searchable = false, size = 'sm', width, emptyMessage = 'No results', disabled = false, renderOption,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Rough menu height (options ~36px, list capped at 220px, plus padding/search) so a short
  // list opens downward whenever it fits. An empty list still shows one "No results" row.
  const menuHeight = Math.min(Math.max(options.length, 1) * 36, 220) + 16 + (searchable ? 44 : 0);
  const pos = useAnchoredPosition(triggerRef, open && !disabled, menuHeight);

  const selected = options.find((o) => o.value === value);
  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return undefined;
    const close = () => { setOpen(false); setSearch(''); };
    const onMouse = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <Wrapper ref={wrapRef} style={{ width }}>
      <div style={{ position: 'relative' }}>
        <Trigger
          type="button"
          $sz={size}
          $open={open}
          $disabled={disabled}
          ref={triggerRef}
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            setOpen(!open);
            if (open) setSearch('');
          }}
        >
          <Label>{selected ? selected.label : <span style={{ color: 'var(--koala-text-tertiary)' }}>{placeholder}</span>}</Label>
        </Trigger>
        <ChevronWrap $open={open}>
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
          </svg>
        </ChevronWrap>
      </div>
      {open && !disabled && pos && createPortal(
        <Menu ref={menuRef} data-koala-select-menu="" style={pos}>
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
        </Menu>,
        document.body,
      )}
    </Wrapper>
  );
}

export default Select;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import MenuListItem from '../menuListItem';
import { DropdownButton } from '../dropdownButton/dropdownButton';
import type { ButtonSize } from '../button/types';

/**
 * CompactSelect — dense filter selects.
 * @deprecated Align with Select/MenuList long-term. Re-evaluate after Phase 3; do not add new call sites for simple menus.
 */
export type SelectKey = string | number;

export type SelectOption<T extends SelectKey = string> = {
  value: T;
  label: React.ReactNode;
  details?: React.ReactNode;
  disabled?: boolean;
  leadingItems?: React.ReactNode;
  trailingItems?: React.ReactNode;
  textValue?: string;
};

export type SelectSection<T extends SelectKey = string> = {
  label?: React.ReactNode;
  key?: SelectKey;
  options: SelectOption<T>[];
  disabled?: boolean;
};

export type SelectOptionOrSection<T extends SelectKey = string> = SelectOption<T> | SelectSection<T>;

type BaseProps<T extends SelectKey> = {
  options: SelectOptionOrSection<T>[];
  disabled?: boolean;
  size?: ButtonSize;
  prefix?: React.ReactNode;
  menuTitle?: React.ReactNode;
  menuWidth?: number | string;
  menuMinWidth?: number | string;
  emptyMessage?: React.ReactNode;
  clearable?: boolean;
  search?: boolean | { placeholder?: string };
  menuBody?: React.ReactNode | ((actions: { close: () => void }) => React.ReactNode);
  hideOptions?: boolean;
  menuClassName?: string;
  trigger?: (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref: React.Ref<HTMLButtonElement> }, isOpen: boolean) => React.ReactNode;
  triggerLabel?: React.ReactNode;
  align?: 'left' | 'right';
};

export type SingleSelectProps<T extends SelectKey = string> = BaseProps<T> & {
  multiple?: false;
  value?: T;
  onChange?: (option: SelectOption<T>) => void;
};

export type MultipleSelectProps<T extends SelectKey = string> = BaseProps<T> & {
  multiple: true;
  value?: T[];
  onChange?: (options: SelectOption<T>[]) => void;
};

export type CompactSelectProps<T extends SelectKey = string> = SingleSelectProps<T> | MultipleSelectProps<T>;

function isSection<T extends SelectKey>(item: SelectOptionOrSection<T>): item is SelectSection<T> {
  return 'options' in item;
}

function flattenOptions<T extends SelectKey>(options: SelectOptionOrSection<T>[]): SelectOption<T>[] {
  return options.flatMap((item) => (isSection(item) ? item.options : [item]));
}

function optionText<T extends SelectKey>(opt: SelectOption<T>): string {
  if (opt.textValue) return opt.textValue;
  if (typeof opt.label === 'string') return opt.label;
  return String(opt.value);
}

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="var(--koala-bg-brand)" aria-hidden="true">
    <path fillRule="evenodd" d="M13.36 4.5a.75.75 0 0 1 .14 1.05l-7 9a.75.75 0 0 1-1.11.07l-3.5-3.5a.75.75 0 0 1 0-1.06l.08-.08a.75.75 0 0 1 .98 0L5.5 12.5l6.3-8.1a.75.75 0 0 1 1.05-.14l.01.01z" clipRule="evenodd" />
  </svg>
);

export function CompactSelect<T extends SelectKey = string>(props: CompactSelectProps<T>) {
  const {
    options,
    disabled,
    size = 'sm',
    prefix,
    menuTitle,
    menuWidth,
    menuMinWidth,
    emptyMessage = 'No options found',
    clearable,
    search,
    menuBody,
    hideOptions,
    menuClassName = '',
    trigger,
    triggerLabel,
    align = 'left',
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const flat = useMemo(() => flattenOptions(options), [options]);
  const searchable = !!search;
  const searchPlaceholder = typeof search === 'object' ? search.placeholder ?? 'Search…' : 'Search…';

  const selectedOptions = useMemo(() => {
    if (props.multiple) {
      const vals = props.value ?? [];
      return flat.filter((o) => vals.includes(o.value));
    }
    if (props.value === undefined || props.value === null || props.value === '') return [];
    return flat.filter((o) => o.value === props.value);
  }, [flat, props]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options
      .map((item) => {
        if (isSection(item)) {
          const opts = item.options.filter((o) => optionText(o).toLowerCase().includes(q));
          return opts.length ? { ...item, options: opts } : null;
        }
        return optionText(item).toLowerCase().includes(q) ? item : null;
      })
      .filter(Boolean) as SelectOptionOrSection<T>[];
  }, [options, query]);

  const close = () => { setOpen(false); setQuery(''); };

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const defaultLabel = useMemo(() => {
    if (triggerLabel) return triggerLabel;
    if (selectedOptions.length === 0) return 'None';
    if (selectedOptions.length === 1) return selectedOptions[0].label;
    return (
      <>
        {selectedOptions[0].label}
        <span className="koala-compact-select-badge">+{selectedOptions.length - 1}</span>
      </>
    );
  }, [selectedOptions, triggerLabel]);

  const toggleOption = (opt: SelectOption<T>) => {
    if (opt.disabled) return;
    if (props.multiple) {
      const current = new Set(props.value ?? []);
      if (current.has(opt.value)) current.delete(opt.value);
      else current.add(opt.value);
      const next = flat.filter((o) => current.has(o.value));
      (props.onChange as ((options: SelectOption<T>[]) => void) | undefined)?.(next);
      return;
    }
    (props.onChange as ((option: SelectOption<T>) => void) | undefined)?.(opt);
    close();
  };

  const clear = () => {
    if (props.multiple) {
      (props.onChange as ((options: SelectOption<T>[]) => void) | undefined)?.([]);
    } else {
      (props.onChange as ((option: SelectOption<T>) => void) | undefined)?.({ value: '' as T, label: '' });
    }
    close();
  };

  const triggerProps: React.ButtonHTMLAttributes<HTMLButtonElement> & { ref: React.Ref<HTMLButtonElement> } = {
    ref: triggerRef,
    disabled,
    onClick: () => setOpen((v) => !v),
  };

  const menuBodyNode = typeof menuBody === 'function' ? menuBody({ close }) : menuBody;

  return (
    <div ref={wrapRef} className="koala-compact-select" data-is-open={open || undefined}>
      {trigger ? (
        trigger({ ...triggerProps, 'aria-expanded': open, 'aria-haspopup': true }, open)
      ) : (
        <DropdownButton
          {...triggerProps}
          isOpen={open}
          prefix={prefix}
          size={size}
          variant="secondary"
        >
          <>{defaultLabel}</>
        </DropdownButton>
      )}

      {open && (
        <div
          className={`koala-compact-select-menu${menuClassName ? ` ${menuClassName}` : ''}`}
          style={{
            width: menuWidth,
            minWidth: menuMinWidth ?? 200,
            [align === 'right' ? 'right' : 'left']: 0,
          }}
          role="listbox"
        >
          {(menuTitle || (clearable && selectedOptions.length > 0)) && (
            <div className="koala-compact-select-menu-header">
              {menuTitle && <span className="koala-compact-select-menu-title">{menuTitle}</span>}
              {clearable && selectedOptions.length > 0 && (
                <button type="button" className="koala-compact-select-clear" onClick={clear}>
                  Clear
                </button>
              )}
            </div>
          )}

          {searchable && (
            <div className="koala-compact-select-search">
              <input
                autoFocus
                value={query}
                placeholder={searchPlaceholder}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}

          {menuBodyNode}

          {!hideOptions && (
            <div className="koala-compact-select-list styled-scrollbar">
              {filtered.length === 0 ? (
                <div className="koala-compact-select-empty">{emptyMessage}</div>
              ) : filtered.map((item, idx) => {
                if (isSection(item)) {
                  return (
                    <div key={item.key ?? idx} className="koala-compact-select-section">
                      {item.label && <div className="koala-compact-select-section-label">{item.label}</div>}
                      {item.options.map((opt) => {
                        const selected = props.multiple
                          ? (props.value ?? []).includes(opt.value)
                          : props.value === opt.value;
                        return (
                          <MenuListItem
                            key={String(opt.value)}
                            label={opt.label}
                            details={opt.details}
                            leadingItems={opt.leadingItems}
                            trailingItems={selected ? <CheckIcon /> : opt.trailingItems}
                            disabled={opt.disabled || item.disabled}
                            onClick={() => toggleOption(opt)}
                          />
                        );
                      })}
                    </div>
                  );
                }
                const selected = props.multiple
                  ? (props.value ?? []).includes(item.value)
                  : props.value === item.value;
                return (
                  <MenuListItem
                    key={String(item.value)}
                    label={item.label}
                    details={item.details}
                    leadingItems={item.leadingItems}
                    trailingItems={selected ? <CheckIcon /> : item.trailingItems}
                    disabled={item.disabled}
                    onClick={() => toggleOption(item)}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CompactSelect;

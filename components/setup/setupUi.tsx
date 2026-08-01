import Head from 'next/head';
import { createPortal } from 'react-dom';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import KoalaHeader from '../koala/shell/Header';
import { KoalaPage, KoalaPanel, KoalaPanelBody } from '../koala/layout';
import Input from '../koala/primitives/Input';

const SETUP_WIZARD_WIDTH_NARROW = 480;
const SETUP_WIZARD_WIDTH_WIDE = 880;
const FONT = 'var(--font-family-primary)';

export type SetupLayout = 'narrow' | 'wide';

function layoutMaxWidth(layout: SetupLayout): number {
  return layout === 'wide' ? SETUP_WIZARD_WIDTH_WIDE : SETUP_WIZARD_WIDTH_NARROW;
}

export const SetupLogo = () => (
  <a href="/" aria-label="Home" style={{ display: 'inline-flex', alignItems: 'center' }}>
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: 28, borderRadius: 7, background: '#F84416', flexShrink: 0,
    }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </span>
  </a>
);

export function SetupShell({ title, children, layout = 'narrow' }: { title: string; children: ReactNode; layout?: SetupLayout }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <KoalaHeader breadcrumb={<SetupLogo />} />
        <KoalaPage maxWidth={layoutMaxWidth(layout)}>
          <div className={`koala-setup-center koala-setup-center--${layout}`}>{children}</div>
        </KoalaPage>
      </div>
    </>
  );
}

export function SetupWizardCard({ children, layout = 'narrow' }: { children: ReactNode; layout?: SetupLayout }) {
  return (
    <div className={`koala-setup-card koala-setup-card--${layout}`} style={{ width: '100%' }}>
      <KoalaPanel className="koala-panel--setup">
        <KoalaPanelBody>{children}</KoalaPanelBody>
      </KoalaPanel>
    </div>
  );
}

type SetupDropdownMenuProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  id?: string;
};

/** Portal dropdown — avoids clipping by KoalaPanel overflow and scroll parents. */
export function SetupDropdownMenu({ open, anchorRef, onClose, children, id }: SetupDropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => { setMounted(true); }, []);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return undefined;
    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, anchorRef]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      className="koala-setup-menu koala-setup-menu--portal"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
      role="listbox"
    >
      {children}
    </div>,
    document.body,
  );
}

type SetupSearchableMenuProps<T> = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  filter: string;
  onFilterChange: (value: string) => void;
  placeholder: string;
  items: T[];
  filterItem: (item: T, query: string) => boolean;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
  listMaxHeight?: number;
  footer?: ReactNode;
};

/** Searchable list inside a portal dropdown (GSC sites, locations, etc.). */
export function SetupSearchableMenu<T>({
  open,
  anchorRef,
  onClose,
  filter,
  onFilterChange,
  placeholder,
  items,
  filterItem,
  renderItem,
  getKey,
  listMaxHeight,
  footer,
}: SetupSearchableMenuProps<T>) {
  const q = filter.trim().toLowerCase();
  const visible = q ? items.filter((item) => filterItem(item, q)) : items;

  return (
    <SetupDropdownMenu open={open} anchorRef={anchorRef} onClose={onClose}>
      <div className="koala-setup-menu-search">
        <Input
          autoFocus
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder={placeholder}
          size="sm"
        />
      </div>
      <div className="koala-setup-menu-list" style={listMaxHeight ? { maxHeight: listMaxHeight } : undefined}>
        {visible.map((item) => (
          <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
        ))}
      </div>
      {footer}
    </SetupDropdownMenu>
  );
}

export function SetupStepProgress({ step }: { step: 1 | 2 }) {
  return (
    <div className="koala-setup-progress" aria-label={`Step ${step} of 2`}>
      <div className={`koala-setup-progress-seg${step >= 1 ? ' koala-setup-progress-seg--active' : ''}${step > 1 ? ' koala-setup-progress-seg--complete' : ''}`} />
      <div className={`koala-setup-progress-seg${step === 2 ? ' koala-setup-progress-seg--active' : ''}`} />
    </div>
  );
}

export function SetupHeader({ title, description }: { title: string; description: string }) {
  return (
    <header style={{ marginBottom: 24 }}>
      <h1 style={{
        margin: '0 0 8px', fontSize: 20, fontWeight: 500, lineHeight: 1.2,
        color: '#181225', letterSpacing: '-0.01em', fontFamily: FONT,
      }}
      >
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.45, color: '#6a6772', fontFamily: FONT }}>
        {description}
      </p>
    </header>
  );
}

export function SetupField({
  label, hint, optional, children,
}: { label: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <label className="koala-setup-field-label">
        {label}
        {optional && <span style={{ fontWeight: 400, color: '#6a6772' }}> (optional)</span>}
      </label>
      {hint && <p className="koala-setup-field-hint">{hint}</p>}
      {children}
    </div>
  );
}

export const ChevronDown = ({ open }: { open: boolean }) => (
  <span
    aria-hidden="true"
    style={{
      marginLeft: 'auto', display: 'inline-flex', flexShrink: 0,
      transition: 'transform 150ms ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
      color: '#6a6772',
    }}
  >
    <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06" clipRule="evenodd" />
    </svg>
  </span>
);

export const Spinner = ({ size = 14 }: { size?: number }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: '2px solid #e5e5e5', borderTopColor: '#F84416', borderRadius: '50%',
          animation: 'koala-setup-spin 0.7s linear infinite',
    }}
  />
);

export const CheckCircle = () => (
  <span className="koala-setup-benefit-check" aria-hidden="true">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export function OrDivider() {
  return <div className="koala-setup-or">or</div>;
}

export function SetupError({ message }: { message: string }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: '#d50000', fontFamily: FONT }} role="alert">
      {message}
    </p>
  );
}

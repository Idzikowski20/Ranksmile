import Head from 'next/head';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import KoalaHeader from '../koala/shell/Header';
import { KoalaPage, KoalaPanel, KoalaPanelBody } from '../koala/layout';
import Input from '../koala/primitives/Input';
import { MenuList } from '../koala/core';
import { BounceSmileyAnimation } from '../pixel-perfect/bounce-smiley-animation';

const SETUP_WIZARD_WIDTH_NARROW = 480;
const SETUP_WIZARD_WIDTH_WIDE = 880;
export type SetupLayout = 'narrow' | 'wide';

function layoutMaxWidth(layout: SetupLayout): number {
  return layout === 'wide' ? SETUP_WIZARD_WIDTH_WIDE : SETUP_WIZARD_WIDTH_NARROW;
}

export const SetupLogo = () => (
  <Link href="/" passHref>
    <a aria-label="Ranksmile home" className="koala-setup-logo">
      <span className="koala-setup-logo-mark" aria-hidden="true">
        <BounceSmileyAnimation compact size={28} entrance={false} />
      </span>
      <span className="koala-setup-logo-word">Ranksmile</span>
    </a>
  </Link>
);

export function SetupShell({ title, children, layout = 'narrow' }: { title: string; children: ReactNode; layout?: SetupLayout }) {
  // AppShell toggles these on <html> for every dashboard route. Setup doesn't render
  // AppShell (no sidebar), so without this the legacy `body { padding: 8px }` rule
  // (desktop-only, pre-Koala) leaks through and insets the whole page.
  useEffect(() => {
    document.documentElement.classList.add('app-framed', 'koala-shell');
    return () => {
      document.documentElement.classList.remove('app-framed', 'koala-shell');
    };
  }, []);

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

  // Pure positioning box — no border/background/shadow of its own. MenuList (the
  // actual Koala dropdown panel) supplies the single visual chrome; giving this
  // wrapper its own card styling nested a square inside a square.
  return createPortal(
    <div
      ref={menuRef}
      id={id}
      className="koala-setup-menu-portal"
      style={{ top: pos.top, left: pos.left, width: pos.width }}
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
      <MenuList
        className="koala-setup-menu-panel"
        search={(
          <Input
            autoFocus
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder={placeholder}
            size="sm"
          />
        )}
        footer={footer}
        role="listbox"
      >
        {visible.map((item) => (
          <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
        ))}
      </MenuList>
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
      <h1 className="koala-setup-title">{title}</h1>
      <p className="koala-setup-description">{description}</p>
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
        {optional && <span className="koala-setup-field-optional"> (optional)</span>}
      </label>
      {hint && <p className="koala-setup-field-hint">{hint}</p>}
      {children}
    </div>
  );
}

export const Spinner = ({ size = 14 }: { size?: number }) => (
  <span aria-hidden="true" className="koala-setup-spinner" style={{ width: size, height: size }} />
);

/** Inline "working on it" line — spinner + label, used while brand data loads. */
export function SetupLoadingLine({ children }: { children: ReactNode }) {
  return (
    <span className="koala-setup-loading-line">
      <Spinner />
      {children}
    </span>
  );
}

export const CheckCircle = () => (
  <span className="koala-setup-benefit-check" aria-hidden="true">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path d="M5 12.5l4.5 4.5L19 7" stroke="var(--koala-text-on-brand)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export function OrDivider() {
  return <div className="koala-setup-or">or</div>;
}

export function SetupError({ message }: { message: string }) {
  return (
    <p className="koala-setup-error" role="alert">{message}</p>
  );
}

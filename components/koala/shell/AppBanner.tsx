import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../icons/Icon';

/** Full-width bar above the shell (Figma `3950:55902`). Single line of text + optional link. */
export type AppBannerState = {
  message: string;
  variant?: 'error' | 'warning' | 'brand';
  action?: { label: string; href: string };
  /** Close button; omit for banners the user must resolve. */
  dismissible?: boolean;
};

type Entry = { id: symbol; banner: AppBannerState };

type Ctx = {
  banner: AppBannerState | null;
  publish: (id: symbol, banner: AppBannerState | null) => void;
};

const AppBannerContext = createContext<Ctx | null>(null);

/**
 * A registry, not a single slot.
 *
 * More than one component can hold the hook at once — a page and a wizard inside it. With
 * one slot it was last-writer-wins in both directions: unmounting the first consumer
 * cleared the second one's banner, and unmounting the SECOND left the first showing
 * nothing at all, because its effect had no reason to re-run. Keeping an entry per
 * consumer means whoever is still mounted keeps their banner, and the most recent one
 * is what shows.
 */
export function AppBannerProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);

  const publish = useCallback((id: symbol, banner: AppBannerState | null) => {
    setEntries((prev) => {
      const without = prev.filter((e) => e.id !== id);
      return banner ? [...without, { id, banner }] : without;
    });
  }, []);

  const value = useMemo(
    () => ({ banner: entries.length ? entries[entries.length - 1].banner : null, publish }),
    [entries, publish],
  );
  return <AppBannerContext.Provider value={value}>{children}</AppBannerContext.Provider>;
}

/**
 * Declarative: pass the banner to show, or `null` for none. Clears on unmount.
 * `useAppBanner(wpMissing ? { message: '…', action: { … } } : null)`
 */
export function useAppBanner(banner: AppBannerState | null) {
  const ctx = useContext(AppBannerContext);
  const publish = ctx?.publish;
  const id = useRef<symbol>();
  if (!id.current) id.current = Symbol('app-banner');
  const key = banner ? JSON.stringify(banner) : '';

  useEffect(() => {
    const self = id.current;
    if (!publish || !self) return undefined;
    publish(self, key ? (JSON.parse(key) as AppBannerState) : null);
    return () => publish(self, null);
  }, [key, publish]);
}

const VARIANT_BG: Record<NonNullable<AppBannerState['variant']>, string> = {
  error: 'var(--koala-status-danger)',
  warning: 'var(--koala-status-warning)',
  brand: 'var(--koala-brand)',
};

/**
 * Text colour per variant, not one hardcoded white.
 *
 * `--koala-status-warning` is amber (#eab308 light, #fdc700 dark). White on it lands
 * around 1.9:1 — WCAG AA wants 4.5:1 for body text — so a warning banner was a white
 * line on a yellow bar. Dark ink on amber clears it comfortably; the other two variants
 * are dark enough backgrounds to keep white.
 */
const VARIANT_FG: Record<NonNullable<AppBannerState['variant']>, string> = {
  error: '#ffffff',
  warning: '#1c1917',
  brand: '#ffffff',
};

const VARIANT_ICON: Record<NonNullable<AppBannerState['variant']>, string> = {
  error: 'WarningCircle',
  warning: 'Warning',
  brand: 'Info',
};

/** Renders the active banner. Mounted by AppShell above the header. */
export function AppBanner() {
  const ctx = useContext(AppBannerContext);
  const banner = ctx?.banner ?? null;
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const key = banner ? JSON.stringify(banner) : '';

  if (!banner || (banner.dismissible && dismissedKey === key)) return null;

  const variant = banner.variant ?? 'error';

  return (
    <div
      className="koala-app-banner"
      style={{ background: VARIANT_BG[variant], color: VARIANT_FG[variant] }}
      role="alert"
    >
      <div className="koala-app-banner__container">
        <span className="koala-app-banner__message">
          <Icon name={VARIANT_ICON[variant]} size={20} weight="regular" />
          {banner.message}
        </span>
        <span className="koala-app-banner__actions">
          {/* Next.js 12 Link: single child, and it must be a real `<a>` (see SidebarItem). */}
          {banner.action && (
            <Link href={banner.action.href} passHref>
              <a className="koala-app-banner__link">
                {banner.action.label}
                <Icon name="ArrowRight" size={16} weight="bold" />
              </a>
            </Link>
          )}
          {banner.dismissible && (
            <button
              type="button"
              className="koala-app-banner__close"
              aria-label="Dismiss"
              onClick={() => setDismissedKey(key)}
            >
              <Icon name="X" size={20} weight="regular" />
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

export default AppBanner;

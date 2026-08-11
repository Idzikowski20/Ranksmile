import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

type Ctx = {
  banner: AppBannerState | null;
  setBanner: (b: AppBannerState | null) => void;
};

const AppBannerContext = createContext<Ctx | null>(null);

export function AppBannerProvider({ children }: { children: React.ReactNode }) {
  const [banner, setBanner] = useState<AppBannerState | null>(null);
  const value = useMemo(() => ({ banner, setBanner }), [banner]);
  return <AppBannerContext.Provider value={value}>{children}</AppBannerContext.Provider>;
}

/**
 * Declarative: pass the banner to show, or `null` for none. Clears on unmount.
 * `useAppBanner(wpMissing ? { message: '…', action: { … } } : null)`
 */
export function useAppBanner(banner: AppBannerState | null) {
  const ctx = useContext(AppBannerContext);
  const setBanner = ctx?.setBanner;
  const key = banner ? JSON.stringify(banner) : '';

  useEffect(() => {
    if (!setBanner) return undefined;
    setBanner(key ? (JSON.parse(key) as AppBannerState) : null);
    return () => setBanner(null);
  }, [key, setBanner]);
}

const VARIANT_BG: Record<NonNullable<AppBannerState['variant']>, string> = {
  error: 'var(--koala-status-danger)',
  warning: 'var(--koala-status-warning)',
  brand: 'var(--koala-brand)',
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
    <div className="koala-app-banner" style={{ background: VARIANT_BG[variant] }} role="alert">
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

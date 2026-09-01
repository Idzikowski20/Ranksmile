import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../icons/Icon';
import { Spinner } from '../primitives/Spinner';
import { isBannerDismissed, markBannerDismissed } from '../../../lib/bannerDismissal';

/** Full-width bar above the shell (Figma `3950:55902`). Single line of text + optional link. */
export type AppBannerState = {
  message: string;
  variant?: 'error' | 'warning' | 'brand';
  action?: { label: string; href: string };
  /**
   * Identity for the dismiss button, when `message` changes on its own — a countdown
   * rewrites it every second, and keying dismissal on the message meant the banner came
   * straight back on the next tick. Defaults to the message.
   */
  dismissKey?: string;
  /**
   * Work is running — a spinner takes the action slot. The countdown itself lives in
   * `message`, because the owner of the retry owns the timer: `useAppBanner` round-trips
   * this object through JSON, so a callback or a live counter cannot travel in it.
   */
  busy?: boolean;
  /** Close button; omit for banners the user must resolve. */
  dismissible?: boolean;
  /**
   * Remember the dismissal across reloads (persisted, keyed on `dismissKey`/`message`).
   * For standing announcements that should not come back once closed — unlike a warning,
   * which must reappear next session while the condition it names still holds.
   */
  persistDismiss?: boolean;
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
  // Track dismissals per closeKey, not a single "last dismissed" key: banners come and
  // go within one AppShell mount (a page publishes an error over the standing
  // announcement, then clears it), and a shared key meant dismissing one un-dismissed
  // the other when it reappeared.
  const [dismissedKeys, setDismissedKeys] = useState<ReadonlySet<string>>(() => new Set());
  const addDismissed = useCallback((key: string) => {
    setDismissedKeys((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);
  // Dismissal is keyed on the stable identity, not the rendered text.
  const closeKey = banner?.dismissKey ?? banner?.message ?? '';
  const persist = banner?.persistDismiss ?? false;

  // Restore a persisted dismissal after mount — reading storage during render would
  // mismatch the server-rendered null.
  useEffect(() => {
    if (persist && closeKey && isBannerDismissed(closeKey)) addDismissed(closeKey);
  }, [persist, closeKey, addDismissed]);

  if (!banner || (banner.dismissible && dismissedKeys.has(closeKey))) return null;

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
          {banner.busy && <Spinner size={16} color="currentColor" />}
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
              onClick={() => {
                addDismissed(closeKey);
                if (persist) markBannerDismissed(closeKey);
              }}
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

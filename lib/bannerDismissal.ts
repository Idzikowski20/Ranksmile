/**
 * Persisted dismissal for standing announcement banners.
 *
 * Lives outside `components/koala` on purpose: koala components must not touch
 * storage directly (see the `theme-io` rule in check-koala-tokens). All calls are
 * SSR-safe and swallow storage errors (private mode, blocked cookies) — a failed
 * read just means the banner shows.
 */
const PREFIX = 'koala-banner-dismissed:';

export function isBannerDismissed(key: string): boolean {
  if (!key) return false;
  try {
    return localStorage.getItem(`${PREFIX}${key}`) != null;
  } catch {
    return false;
  }
}

export function markBannerDismissed(key: string): void {
  if (!key) return;
  try {
    localStorage.setItem(`${PREFIX}${key}`, '1');
  } catch {
    /* storage unavailable — dismissal only lasts this session */
  }
}

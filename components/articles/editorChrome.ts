/**
 * Editor-zone chrome tokens (articles/[id]).
 * TipTap structure stays; UI chrome uses Koala CSS vars — not zinc / Sentry purple.
 */
export const EC = {
  text: 'var(--koala-text-primary)',
  textSecondary: 'var(--koala-text-secondary)',
  textTertiary: 'var(--koala-text-tertiary)',
  textDisabled: 'var(--koala-text-disabled)',
  brand: 'var(--koala-text-brand)',
  link: 'var(--koala-text-link)',
  onBrand: 'var(--koala-text-on-brand)',
  surface: 'var(--koala-bg-primary)',
  surfaceMuted: 'var(--koala-bg-secondary)',
  surfaceTertiary: 'var(--koala-bg-tertiary)',
  inverse: 'var(--koala-bg-inverse)',
  border: 'var(--koala-border-primary)',
  borderStrong: 'var(--koala-border-secondary)',
  brandBg: 'var(--koala-bg-brand)',
  btnBrand: 'var(--koala-btn-brand-bg)',
  success: 'var(--koala-status-success)',
  successBg: 'var(--koala-status-success-bg)',
  warning: 'var(--koala-status-warning)',
  warningBg: 'var(--koala-status-warning-bg)',
  danger: 'var(--koala-status-danger)',
  dangerBg: 'var(--koala-status-danger-bg)',
  activeBg: 'color-mix(in srgb, var(--koala-text-brand) 12%, transparent)',
  shadow: 'var(--koala-shadow-lg, 0px 8px 24px rgba(24,26,34,0.16))',
} as const;

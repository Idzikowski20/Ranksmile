import { radius } from './effects';
import type { ThemeSemantic } from './themes';

/**
 * Semantic colors resolve through CSS variables so Light / Dark / Cream / Moonlight
 * can swap without rewriting Emotion templates. Defaults live on `:root` (Light);
 * `KoalaThemeProvider` + `[data-theme]` override the vars.
 */
export const semantic: ThemeSemantic = {
  background: {
    primary: 'var(--koala-bg-primary)',
    secondary: 'var(--koala-bg-secondary)',
    tertiary: 'var(--koala-bg-tertiary)',
    brand: 'var(--koala-bg-brand)',
    inverse: 'var(--koala-bg-inverse)',
  },
  text: {
    primary: 'var(--koala-text-primary)',
    secondary: 'var(--koala-text-secondary)',
    tertiary: 'var(--koala-text-tertiary)',
    disabled: 'var(--koala-text-disabled)',
    onBrand: 'var(--koala-text-on-brand)',
    onBrandSecondary: 'var(--koala-text-on-brand-secondary)',
    brand: 'var(--koala-text-brand)',
    link: 'var(--koala-text-link)',
  },
  border: {
    primary: 'var(--koala-border-primary)',
    secondary: 'var(--koala-border-secondary)',
    strong: 'var(--koala-border-strong)',
    brand: 'var(--koala-border-brand)',
    focus: 'var(--koala-border-focus)',
  },
  status: {
    danger: 'var(--koala-status-danger)',
    dangerBg: 'var(--koala-status-danger-bg)',
    warning: 'var(--koala-status-warning)',
    warningBg: 'var(--koala-status-warning-bg)',
    success: 'var(--koala-status-success)',
    successBg: 'var(--koala-status-success-bg)',
  },
  button: {
    brand: {
      bg: 'var(--koala-btn-brand-bg)',
      bgHover: 'var(--koala-btn-brand-bg-hover)',
      fg: 'var(--koala-btn-brand-fg)',
      radius: radius.button.default,
    },
    secondary: {
      bg: 'var(--koala-btn-secondary-bg)',
      bgHover: 'var(--koala-btn-secondary-bg-hover)',
      fg: 'var(--koala-btn-secondary-fg)',
      border: 'var(--koala-btn-secondary-border)',
      radius: radius.button.default,
    },
    ghost: {
      bg: 'transparent',
      bgHover: 'var(--koala-btn-ghost-bg-hover)',
      fg: 'var(--koala-btn-ghost-fg)',
    },
  },
  input: {
    bg: 'var(--koala-input-bg)',
    border: 'var(--koala-input-border)',
    borderHover: 'var(--koala-input-border-hover)',
    borderFocus: 'var(--koala-input-border-focus)',
    borderError: 'var(--koala-input-border-error)',
    placeholder: 'var(--koala-input-placeholder)',
    radius: radius.default,
  },
  card: {
    bg: 'var(--koala-card-bg)',
    border: 'var(--koala-card-border)',
    radius: radius.card.default,
  },
  focus: 'var(--koala-focus)',
};

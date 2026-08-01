/** Spacing scale — re-export + semantic aliases. Prefer these over raw px. */

export { space, grid } from './effects';

export const spacing = {
  none: '0px',
  '2xs': '2px',
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '32px',
  '4xl': '48px',
  '5xl': '64px',
} as const;

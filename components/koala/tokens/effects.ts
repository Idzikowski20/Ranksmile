/** Koala UI v11 — radius, shadow, spacing (Effects `5828:163350` + product padding vars). */

export const radius = {
  none: '0px',
  sm: '8px',
  md: '10px',
  default: '12px',
  lg: '14px',
  xl: '16px',
  '2xl': '20px',
  full: '999px',
  button: {
    sm: '10px',
    default: '12px',
    lg: '14px',
  },
  card: {
    sm: '12px',
    default: '16px',
  },
} as const;

export const shadow = {
  xs: '0px 1px 1px rgba(0,0,0,0.04)',
  sm: '0px 1px 2px rgba(0,0,0,0.05), 0px 1px 3px rgba(0,0,0,0.04)',
  md: '0px 4px 12px rgba(0,0,0,0.08)',
  lg: '0px 12px 32px rgba(0,0,0,0.12)',
  focus: '0 0 0 2px #ffffff, 0 0 0 4px #f84416',
} as const;

export const space = {
  '0': '0px',
  '0.5': '2px',
  '1': '4px',
  '1.5': '6px',
  '2': '8px',
  '2.5': '10px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
  '24': '96px',
} as const;

export const grid = {
  containerMax: '1280px',
  containerPadding: '32px',
  marketingTopBottom: '96px',
  gapMd: '64px',
  columnsDesktop: 12,
  columnsTablet: 6,
  columnsMobile: 4,
} as const;

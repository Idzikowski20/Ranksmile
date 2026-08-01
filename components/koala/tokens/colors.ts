/** Koala UI v11 — primitive color scales (Figma Color page `3950:55876`). */

export const greyNeutral = {
  950: '#0a0a0a',
  900: '#1a1a1a',
  800: '#292929',
  700: '#434343',
  600: '#575757',
  500: '#767676',
  400: '#a5a5a5',
  300: '#d6d6d6',
  200: '#e5e5e5',
  100: '#f5f5f5',
  50: '#fafafa',
} as const;

export const darkOrange = {
  950: '#430807',
  900: '#7c1712',
  800: '#991813',
  700: '#c11c0d',
  600: '#e92b0d',
  500: '#f84416',
  400: '#fa6b3d',
  300: '#fc9e75',
  200: '#fec6aa',
  100: '#ffe4d5',
  50: '#fff3ed',
} as const;

export const orange = {
  950: '#431407',
  900: '#7c2d12',
  800: '#9a3412',
  700: '#c2410c',
  600: '#ea580c',
  500: '#f97316',
  400: '#fb923c',
  300: '#fdba74',
  200: '#fed7aa',
  100: '#ffedd5',
  50: '#fff7ed',
} as const;

export const red = {
  950: '#450a0a',
  900: '#7f1d1d',
  800: '#991b1b',
  700: '#b91c1c',
  600: '#dc2626',
  500: '#ef4444',
  400: '#f87171',
  300: '#fca5a5',
  200: '#fecaca',
  100: '#fee2e2',
  50: '#fef2f2',
} as const;

export const yellow = {
  950: '#432004',
  900: '#733e0a',
  800: '#894b00',
  700: '#a65f00',
  600: '#d08700',
  500: '#f0b100',
  400: '#fdc700',
  300: '#ffdf20',
  200: '#fff085',
  100: '#fef9c2',
  50: '#fefce8',
} as const;

export const green = {
  950: '#052e16',
  900: '#14532d',
  800: '#166534',
  700: '#15803d',
  600: '#16a34a',
  500: '#22c55e',
  400: '#4ade80',
  300: '#86efac',
  200: '#bbf7d0',
  100: '#dcfce7',
  50: '#f0fdf4',
} as const;

export const darkGreen = {
  950: '#1d2e16',
  900: '#2f4126',
  800: '#344c28',
  700: '#3f5d2e',
  600: '#4f7937',
  500: '#679949',
  400: '#86b467',
  300: '#a5ca8c',
  200: '#c8dfb7',
  100: '#e2eed9',
  50: '#f2f8ed',
} as const;

export const softGreen = {
  950: '#15260d',
  900: '#2e4720',
  800: '#345321',
  700: '#3d6823',
  600: '#4e8729',
  500: '#67aa38',
  400: '#86c556',
  300: '#a6d87e',
  200: '#c9e8ae',
  100: '#e3f3d4',
  50: '#f2faeb',
} as const;

export const blue = {
  950: '#172554',
  900: '#1e3a8a',
  800: '#1e40af',
  700: '#1d4ed8',
  600: '#316cec',
  500: '#3b82f6',
  400: '#60a5fa',
  300: '#93c5fd',
  200: '#bfdbfe',
  100: '#dbeafe',
  50: '#eff6ff',
} as const;

export const darkBlue = {
  950: '#0d122e',
  900: '#151e4c',
  800: '#202d72',
  700: '#2a3b98',
  600: '#354abe',
  500: '#3f59e4',
  400: '#5f75e9',
  300: '#7f90ed',
  200: '#9facf2',
  100: '#bfc8f6',
  50: '#d9defa',
} as const;

export const purple = {
  950: '#2e1065',
  900: '#4c1d95',
  800: '#5b21b6',
  700: '#6d28d9',
  600: '#7c3aed',
  500: '#8b5cf6',
  400: '#a78bfa',
  300: '#c4b5fd',
  200: '#ddd6fe',
  100: '#ede9fe',
  50: '#f5f3ff',
} as const;

export const pink = {
  950: '#510424',
  900: '#861043',
  800: '#a3004c',
  700: '#c6005c',
  600: '#e60076',
  500: '#f6339a',
  400: '#fb64b6',
  300: '#fda5d5',
  200: '#fccee8',
  100: '#fdf2f8',
  50: '#fff1f2',
} as const;

export const cream = {
  950: '#0d0d0c',
  900: '#1b1a18',
  800: '#353431',
  700: '#504e49',
  600: '#6a6762',
  500: '#85817a',
  400: '#9d9a95',
  300: '#b6b4af',
  200: '#d1cec7',
  100: '#e8e6e3',
  50: '#f1f0ee',
} as const;

export const slate = {
  950: '#09090b',
  900: '#16161d',
  800: '#24252e',
  700: '#3a3b4a',
  600: '#4c4e61',
  500: '#676a83',
  400: '#9b9cb0',
  300: '#d1d1db',
  200: '#d7d7e0',
  100: '#ededf1',
  50: '#f7f7f8',
} as const;

/** Brand main = Dark Orange 500 (Components/Button/Brand/bg-brand). */
export const brandMain = darkOrange[500];

export const palette = {
  greyNeutral,
  darkOrange,
  orange,
  red,
  yellow,
  green,
  darkGreen,
  softGreen,
  blue,
  darkBlue,
  purple,
  pink,
  cream,
  slate,
  brandMain,
  white: '#ffffff',
  black: '#000000',
} as const;

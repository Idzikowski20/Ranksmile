import type { Theme as EmotionTheme } from '@emotion/react';
import { css } from '@emotion/react';

declare module '@emotion/react' {
  export interface Theme extends SentryTheme {}
}

type StrictCSSObject = React.CSSProperties & {
  '&::before'?: React.CSSProperties;
  '&::after'?: React.CSSProperties;
  '&:hover'?: React.CSSProperties;
  '&:focus-visible'?: React.CSSProperties;
  '&:disabled'?: React.CSSProperties;
  '&[disabled]'?: React.CSSProperties;
  '&>*'?: React.CSSProperties;
};

const fontFamily = "Rubik, 'Avenir Next', 'InterVariable', 'Inter', Arial, sans-serif";
const monoFamily = "'Roboto Mono', Monaco, Consolas, 'Courier New', monospace";

const motionDurations = { fast: 120, moderate: 160, slow: 240 } as const;
const motionCurves = {
  smooth: [0.72, 0, 0.16, 1],
  snap: [0.8, -0.4, 0.5, 1],
  enter: [0.24, 1, 0.32, 1],
  exit: [0.64, 0, 0.8, 0],
} as const;

function motionCurveWithDuration(dur: number, easing: readonly number[]) {
  return `${dur}ms cubic-bezier(${easing.join(', ')})`;
}

const tokens = {
  background: {
    primary: '#FFFFFF',
    secondary: '#F8F8F9',
    tertiary: '#F0F0F2',
    overlay: '#FFFFFF',
    transparent: {
      neutral: { muted: '#0000200F', moderate: '#00002014' },
      accent: { muted: '#0008F012', moderate: '#0008F01A' },
      success: { muted: '#00B8001C', moderate: '#00B80026' },
      warning: { muted: '#E0B01030', moderate: '#E0B01040' },
      danger: { muted: '#F828081C', moderate: '#F8280826' },
      promotion: { muted: '#F000901A', moderate: '#F0009026' },
    },
    vibrant: {
      accent: '#7553FF',
      success: '#00F261',
      warning: '#FFCE00',
      danger: '#FF002B',
      promotion: '#FC5CB4',
      neutral: '#787581',
    },
    onVibrant: {
      accent: '#FFFFFF',
      success: '#000000',
      warning: '#000000',
      danger: '#FFFFFF',
      promotion: '#000000',
      neutral: '#FFFFFF',
    },
  },
  content: {
    headings: '#181225',
    primary: '#302E36',
    secondary: '#6A6772',
    accent: '#653DE9',
    success: '#008900',
    warning: '#A45200',
    danger: '#D50000',
    promotion: '#C8007E',
    disabled: '#878490',
    onVibrant: {
      light: '#FFFFFF',
      dark: '#000000',
    },
  },
  border: {
    primary: '#DAD9DE',
    secondary: '#E6E6E9',
    neutral: { muted: '#DAD9DE', moderate: '#C0BEC6', vibrant: '#A29FAA' },
    accent: { muted: '#D4D3FF', moderate: '#B7B2FF', vibrant: '#7553FF' },
    success: { muted: '#B5EABB', moderate: '#7CD88A', vibrant: '#009800' },
    warning: { muted: '#F2D88E', moderate: '#EDCA60', vibrant: '#FFCE00' },
    danger: { muted: '#FFC4BD', moderate: '#FF978F', vibrant: '#FF002B' },
    promotion: { muted: '#FFC2E3', moderate: '#FF93CE', vibrant: '#FF70BC' },
    onVibrant: { light: '#FFFFFF', dark: '#000000' },
    none: 'transparent',
  },
  interactive: {
    chonky: {
      embossed: {
        accent: { background: '#7553FF', chonk: '#5827D6', content: '#FFFFFF' },
        neutral: { background: '#FFFFFF', chonk: '#DAD9DE', content: '#181225' },
        danger: { background: '#FF002B', chonk: '#C10000', content: '#FFFFFF' },
        warning: { background: '#FFCE00', chonk: '#D59600', content: '#000000' },
        success: { background: '#00F261', chonk: '#007800', content: '#000000' },
        promotion: { background: '#FC5CB4', chonk: '#B5006F', content: '#000000' },
      },
      debossed: {
        neutral: { background: '#10103008', chonk: '#DAD9DE', content: { primary: '#181225', secondary: '#6A6772', danger: '#D50000' } },
        accent: { background: '#7553FF', chonk: '#5827D6', content: '#FFFFFF' },
      },
    },
    transparent: {
      neutral: { background: { rest: 'transparent' }, content: '#6A6772' },
    },
    link: {
      neutral: { rest: '#6A6772', hover: '#5B5864', active: '#4C4954' },
      accent: { rest: '#653DE9', hover: '#5827D6', active: '#4C0FC0' },
    },
  },
  focus: {
    default: '#7553FF',
    invalid: '#FF002B',
  },
  graphics: {
    neutral: { muted: '#DAD9DE', moderate: '#C0BEC6', vibrant: '#787581' },
    accent: { muted: '#D4D3FF', moderate: '#B7B2FF', vibrant: '#7553FF' },
    success: { muted: '#B5EABB', moderate: '#7CD88A', vibrant: '#009800' },
    warning: { muted: '#F2D88E', moderate: '#EDCA60', vibrant: '#D59600' },
    danger: { muted: '#FFC4BD', moderate: '#FF978F', vibrant: '#FF002B' },
    promotion: { muted: '#FFC2E3', moderate: '#FF93CE', vibrant: '#D9008D' },
  },
} as const;

const space = {
  '0': '0px', '2xs': '2px', xs: '4px', sm: '6px', md: '8px',
  lg: '12px', xl: '16px', '2xl': '24px', '3xl': '32px',
} as const;

const radius = {
  '0': '0px', '2xs': '3px', xs: '4px', sm: '5px', md: '6px',
  lg: '8px', xl: '12px', '2xl': '16px', full: '999px',
} as const;

const border = {
  '0': '0px', md: '1px', lg: '1.5px', xl: '2px', '2xl': '4px',
} as const;

const elevation = {
  sm: '1px', md: '2px', lg: '4px', xl: '6px',
} as const;

const font = {
  family: { sans: fontFamily, mono: monoFamily },
  size: { xs: '11px', sm: '12px', md: '14px', lg: '16px', xl: '20px', '2xl': '24px', '3xl': '32px', '4xl': '40px' },
  weight: { sans: { regular: 400, medium: 500 }, mono: { regular: 425, medium: 500 } },
  lineHeight: { compressed: 1, default: 1.2, comfortable: 1.4, fixed: '1rem' },
} as const;

const motion = {
  duration: motionDurations,
  smooth: {
    fast: motionCurveWithDuration(motionDurations.fast, motionCurves.smooth),
    moderate: motionCurveWithDuration(motionDurations.moderate, motionCurves.smooth),
    slow: motionCurveWithDuration(motionDurations.slow, motionCurves.smooth),
  },
  snap: {
    fast: motionCurveWithDuration(motionDurations.fast, motionCurves.snap),
    moderate: motionCurveWithDuration(motionDurations.moderate, motionCurves.snap),
    slow: motionCurveWithDuration(motionDurations.slow, motionCurves.snap),
  },
  enter: {
    fast: motionCurveWithDuration(motionDurations.fast, motionCurves.enter),
    moderate: motionCurveWithDuration(motionDurations.moderate, motionCurves.enter),
    slow: motionCurveWithDuration(motionDurations.slow, motionCurves.enter),
  },
  exit: {
    fast: motionCurveWithDuration(motionDurations.fast, motionCurves.exit),
    moderate: motionCurveWithDuration(motionDurations.moderate, motionCurves.exit),
    slow: motionCurveWithDuration(motionDurations.slow, motionCurves.exit),
  },
  spring: {
    fast: { type: 'spring' as const, stiffness: 1400, damping: 50 },
    moderate: { type: 'spring' as const, stiffness: 1000, damping: 50 },
    slow: { type: 'spring' as const, stiffness: 600, damping: 50 },
  },
} as const;

const zIndex = {
  initial: 1, header: 1000, dropdown: 1020, drawer: 9999,
  modal: 10000, toast: 10001, hovercard: 10002, tooltip: 10003,
} as const;

const form = {
  md: { height: '36px', minHeight: '36px', fontSize: '0.875rem', lineHeight: '1rem', padding: '8px 16px', borderRadius: radius.lg },
  sm: { height: '32px', minHeight: '32px', fontSize: '0.875rem', lineHeight: '1rem', padding: '6px 12px', borderRadius: radius.md },
  xs: { height: '28px', minHeight: '28px', fontSize: '0.75rem', lineHeight: '1rem', padding: '4px 8px', borderRadius: radius.sm },
} as const;

export const theme = {
  tokens,
  space,
  radius,
  border,
  elevation,
  font,
  motion,
  zIndex,
  form,
  focusRing: (boxShadow: string) => `0 0 0 2px ${tokens.background.primary}, 0 0 0 4px ${tokens.focus.default}`,
  visuallyHidden: css`
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  `,
  type: 'light' as const,
} as const;

export type SentryTheme = typeof theme;

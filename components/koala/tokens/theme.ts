import type { Theme as EmotionTheme } from '@emotion/react';
import { css } from '@emotion/react';
import { palette } from './colors';
import { radius as koalaRadius, shadow, space as koalaSpace } from './effects';
import { semantic } from './semantic';
import type { ThemeName } from './themes';
import { fontWeight, textScale, typeface } from './typography';

declare module '@emotion/react' {
  export interface Theme extends KoalaTheme {}
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

/** Semantic + palette bridge compatible with legacy core consumers. */
const tokens = {
  background: {
    primary: semantic.background.primary,
    secondary: semantic.background.secondary,
    tertiary: semantic.background.tertiary,
    overlay: semantic.background.primary,
    brand: semantic.background.brand,
    transparent: {
      neutral: { muted: '#0000000F', moderate: '#00000014' },
      accent: { muted: `${palette.brandMain}1C`, moderate: `${palette.brandMain}26` },
      success: { muted: `${palette.green[500]}1C`, moderate: `${palette.green[500]}26` },
      warning: { muted: `${palette.yellow[500]}30`, moderate: `${palette.yellow[500]}40` },
      danger: { muted: `${palette.red[500]}1C`, moderate: `${palette.red[500]}26` },
      promotion: { muted: `${palette.pink[500]}1A`, moderate: `${palette.pink[500]}26` },
    },
    vibrant: {
      accent: palette.brandMain,
      success: palette.green[500],
      warning: palette.yellow[400],
      danger: palette.red[500],
      promotion: palette.pink[500],
      neutral: palette.greyNeutral[500],
    },
    onVibrant: {
      accent: '#FFFFFF',
      success: '#000000',
      warning: '#000000',
      danger: '#FFFFFF',
      promotion: '#FFFFFF',
      neutral: '#FFFFFF',
    },
  },
  content: {
    headings: semantic.text.primary,
    primary: semantic.text.primary,
    secondary: semantic.text.secondary,
    accent: semantic.text.link,
    success: palette.green[700],
    warning: palette.yellow[700],
    danger: palette.red[600],
    promotion: palette.pink[600],
    disabled: semantic.text.disabled,
    onVibrant: {
      light: '#FFFFFF',
      dark: '#000000',
    },
  },
  border: {
    primary: semantic.border.primary,
    secondary: semantic.border.secondary,
    neutral: { muted: semantic.border.primary, moderate: semantic.border.secondary, vibrant: semantic.border.strong },
    accent: { muted: palette.darkOrange[100], moderate: palette.darkOrange[300], vibrant: palette.brandMain },
    success: { muted: palette.green[100], moderate: palette.green[300], vibrant: palette.green[600] },
    warning: { muted: palette.yellow[100], moderate: palette.yellow[300], vibrant: palette.yellow[500] },
    danger: { muted: palette.red[100], moderate: palette.red[300], vibrant: palette.red[500] },
    promotion: { muted: palette.pink[100], moderate: palette.pink[300], vibrant: palette.pink[500] },
    onVibrant: { light: '#FFFFFF', dark: '#000000' },
    none: 'transparent',
  },
  interactive: {
    flat: {
      accent: { background: palette.brandMain, content: '#FFFFFF' },
      neutral: { background: '#FFFFFF', border: semantic.border.primary, content: semantic.text.primary },
      danger: { background: palette.red[500], content: '#FFFFFF' },
      warning: { background: palette.yellow[400], content: '#000000' },
      success: { background: palette.green[500], content: '#000000' },
    },
    transparent: {
      neutral: { background: { rest: 'transparent' }, content: semantic.text.secondary },
    },
    link: {
      neutral: { rest: semantic.text.secondary, hover: palette.greyNeutral[700], active: palette.greyNeutral[800] },
      accent: { rest: semantic.text.link, hover: palette.darkOrange[700], active: palette.darkOrange[800] },
    },
  },
  focus: {
    default: semantic.focus,
    invalid: palette.red[500],
  },
  graphics: {
    neutral: { muted: semantic.border.primary, moderate: semantic.border.secondary, vibrant: palette.greyNeutral[500] },
    accent: { muted: palette.darkOrange[100], moderate: palette.darkOrange[300], vibrant: palette.brandMain },
    success: { muted: palette.green[100], moderate: palette.green[300], vibrant: palette.green[600] },
    warning: { muted: palette.yellow[100], moderate: palette.yellow[300], vibrant: palette.yellow[600] },
    danger: { muted: palette.red[100], moderate: palette.red[300], vibrant: palette.red[500] },
    promotion: { muted: palette.pink[100], moderate: palette.pink[300], vibrant: palette.pink[600] },
  },
} as const;

const space = {
  '0': koalaSpace['0'],
  '2xs': koalaSpace['0.5'],
  xs: koalaSpace['1'],
  sm: koalaSpace['1.5'],
  md: koalaSpace['2'],
  lg: koalaSpace['3'],
  xl: koalaSpace['4'],
  '2xl': koalaSpace['6'],
  '3xl': koalaSpace['8'],
} as const;

const radius = {
  '0': koalaRadius.none,
  '2xs': '3px',
  xs: '4px',
  sm: '5px',
  md: koalaRadius.sm,
  lg: koalaRadius.default,
  xl: koalaRadius.lg,
  '2xl': koalaRadius.xl,
  full: koalaRadius.full,
} as const;

const border = {
  '0': '0px', md: '1px', lg: '1.5px', xl: '2px', '2xl': '4px',
} as const;

const elevation = {
  sm: '1px', md: '2px', lg: '4px', xl: '6px',
} as const;

const font = {
  family: { sans: typeface.body, mono: typeface.mono },
  size: {
    xs: textScale.xs.fontSize,
    sm: textScale.sm.fontSize,
    md: textScale.sm.fontSize,
    lg: textScale.base.fontSize,
    xl: textScale.xl.fontSize,
    '2xl': textScale['2xl'].fontSize,
    '3xl': textScale['3xl'].fontSize,
    '4xl': textScale['4xl'].fontSize,
  },
  weight: {
    sans: { regular: fontWeight.regular, medium: fontWeight.medium, bold: fontWeight.bold },
    mono: { regular: 425, medium: 500 },
  },
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
  md: { height: '40px', minHeight: '40px', fontSize: textScale.sm.fontSize, lineHeight: textScale.sm.lineHeight, padding: '8px 12px', borderRadius: koalaRadius.default },
  sm: { height: '36px', minHeight: '36px', fontSize: textScale.sm.fontSize, lineHeight: textScale.sm.lineHeight, padding: '6px 10px', borderRadius: koalaRadius.sm },
  xs: { height: '32px', minHeight: '32px', fontSize: textScale.xs.fontSize, lineHeight: textScale.xs.lineHeight, padding: '4px 8px', borderRadius: koalaRadius.sm },
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
  palette,
  semantic,
  textScale,
  typeface,
  shadow,
  koalaRadius,
  focusRing: (_boxShadow: string) => shadow.focus,
  visuallyHidden: css`
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    height: 1px;
    overflow: hidden;
    position: absolute;
    white-space: nowrap;
    width: 1px;
  `,
  type: 'light' as ThemeName,
};

export type KoalaTheme = typeof theme & { type: ThemeName; semantic: typeof semantic };
/** @deprecated Use KoalaTheme — alias for migration. */
export type SentryTheme = KoalaTheme;

void (0 as unknown as StrictCSSObject);
void (0 as unknown as EmotionTheme);

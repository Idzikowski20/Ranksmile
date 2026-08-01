import { blue, brandMain, darkOrange, green, greyNeutral, purple, red, yellow } from './colors';

/** Data-viz series colors — charts only; not UI chrome. Unknown kind = compile error. */

export const chartColors = {
  traffic: brandMain,
  rank: blue[500],
  error: red[500],
  ai: purple[500],
  neutral: greyNeutral[300],
  positive: green[500],
  baseline: greyNeutral[200],
  success: green[500],
  warning: yellow[500],
  danger: red[500],
  comparison: greyNeutral[500],
  forecast: purple[400],
  target: greyNeutral[600],
} as const;

export type ChartSeriesKind = keyof typeof chartColors;

/** Stacked organic position buckets — Koala brand scale (Figma bar charts). */
export const chartBucketColors = {
  top3: darkOrange[500],
  pos4_10: darkOrange[400],
  pos11_20: darkOrange[300],
  pos21_50: greyNeutral[300],
  pos51_100: greyNeutral[200],
  serpFeatures: green[500],
} as const;

export type ChartBucketKind = keyof typeof chartBucketColors;

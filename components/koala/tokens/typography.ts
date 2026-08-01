/** Koala UI v11 — typography scale (Figma Typography page `3950:179138`). */

export const typeface = {
  heading: "'DM Sans', system-ui, sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
  mono: "'Roboto Mono', Monaco, Consolas, 'Courier New', monospace",
} as const;

export const textScale = {
  '9xl': { fontSize: '128px', lineHeight: '144px', letterSpacing: '-2.5px' },
  '8xl': { fontSize: '96px', lineHeight: '112px', letterSpacing: '-2px' },
  '7xl': { fontSize: '72px', lineHeight: '80px', letterSpacing: '-1.5px' },
  '6xl': { fontSize: '60px', lineHeight: '68px', letterSpacing: '-0.3px' },
  '5xl': { fontSize: '48px', lineHeight: '56px', letterSpacing: '-0.2px' },
  '4xl': { fontSize: '36px', lineHeight: '40px', letterSpacing: '-0.15px' },
  '3xl': { fontSize: '30px', lineHeight: '36px', letterSpacing: '-0.07px' },
  '2xl': { fontSize: '24px', lineHeight: '32px', letterSpacing: '-0.5px' },
  xl: { fontSize: '20px', lineHeight: '28px', letterSpacing: '-1px' },
  lg: { fontSize: '18px', lineHeight: '26px', letterSpacing: '-0.5px' },
  base: { fontSize: '16px', lineHeight: '24px', letterSpacing: '-0.25px' },
  sm: { fontSize: '14px', lineHeight: '20px', letterSpacing: '-0.4px' },
  xs: { fontSize: '12px', lineHeight: '16px', letterSpacing: '-0.2px' },
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  bold: 700,
} as const;

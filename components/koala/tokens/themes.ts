import { blue, brandMain, cream, darkBlue, darkOrange, green, greyNeutral, purple, red, slate, softGreen, yellow } from './colors';
import { radius } from './effects';

/** Semantic surface map shared by every Koala theme mode. */
export type ThemeSemantic = {
  background: {
    primary: string;
    secondary: string;
    tertiary: string;
    brand: string;
    inverse: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    onBrand: string;
    onBrandSecondary: string;
    /** Foreground for `background.inverse`, which flips with the theme. */
    onInverse: string;
    brand: string;
    link: string;
  };
  border: {
    primary: string;
    secondary: string;
    strong: string;
    brand: string;
    focus: string;
  };
  status: {
    danger: string;
    dangerBg: string;
    warning: string;
    warningBg: string;
    success: string;
    successBg: string;
  };
  button: {
    brand: { bg: string; bgHover: string; fg: string; radius: string };
    secondary: { bg: string; bgHover: string; fg: string; border: string; radius: string };
    ghost: { bg: string; bgHover: string; fg: string };
  };
  input: {
    bg: string;
    border: string;
    borderHover: string;
    borderFocus: string;
    borderError: string;
    placeholder: string;
    radius: string;
  };
  card: { bg: string; border: string; radius: string };
  focus: string;
};

/** Koala UI v11 themes: Light, Dark, Cream, Moonlight. */
export type ThemeName = 'light' | 'dark' | 'cream' | 'moonlight';

export const THEME_NAMES: ThemeName[] = ['light', 'dark', 'cream', 'moonlight'];

export const THEME_LABELS: Record<ThemeName, string> = {
  light: 'Light',
  dark: 'Dark',
  cream: 'Cream',
  moonlight: 'Moonlight',
};

/**
 * Readable ink for a filled button, decided by the background it sits on.
 *
 * `button.brand.fg` was white for every accent, but a primary button uses scale[500]
 * at rest and scale[600] on hover — and green 500/600 are light enough that white text
 * fails AA on both. Picking per accent by hand would leave the next accent to trip over
 * it, so the choice is computed from the colour.
 *
 * sRGB relative luminance (WCAG 2.x), and the darker of the two states decides: a button
 * whose label flips colour halfway through a hover is worse than one that is readable
 * throughout.
 */
function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const channel = (i: number) => {
    const c = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

const INK_DARK = '#1c1917';
const INK_LIGHT = '#ffffff';

/** WCAG contrast ratio between two colours. Exported so tests assert against this
 * implementation instead of a second copy of the formula that can drift from it. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_NORMAL_TEXT = 4.5;

/** The better of the two inks for a pair of backgrounds, with the ratio it achieves. */
function bestInk(bg: string, bgHover: string): { fg: string; ratio: number } {
  const worst = (ink: string) => Math.min(contrast(ink, bg), contrast(ink, bgHover));
  const dark = worst(INK_DARK);
  const light = worst(INK_LIGHT);
  return dark > light ? { fg: INK_DARK, ratio: dark } : { fg: INK_LIGHT, ratio: light };
}

/**
 * A primary-button palette that actually clears AA on both rest and hover.
 *
 * Choosing the better of two inks was not enough: at 500/600, white on purple is 4.23,
 * dark ink on blue drops to 3.74 on hover, and soft green lands at 4.02 — all short of
 * 4.5:1. Neither ink can rescue a mid-tone background, so the background moves instead:
 * one step darker (600/700) is tried next, which is where those three become readable.
 *
 * Returned as a triple rather than just a foreground, because the accessible answer is
 * the pair, not the text colour on its own.
 */
export function readableButton(scale: Record<number, string>): { bg: string; bgHover: string; fg: string } {
  const candidates: Array<[string, string]> = [
    [scale[500], scale[600]],
    [scale[600], scale[700]],
    // Soft green needs the third rung: at 600/700 it reaches 4.36, just short of AA.
    [scale[700], scale[800]],
  ];
  for (const [bg, bgHover] of candidates) {
    const { fg, ratio } = bestInk(bg, bgHover);
    if (ratio >= AA_NORMAL_TEXT) return { bg, bgHover, fg };
  }
  // Nothing clears AA — take the darkest pair and its better ink rather than the lightest.
  const [bg, bgHover] = candidates[candidates.length - 1];
  return { bg, bgHover, fg: bestInk(bg, bgHover).fg };
}

/**
 * The brand button runs through the same AA rule as every accent.
 *
 * `#F84416` carries white at 3.60 and its 600 hover at 4.36 — both under 4.5:1 — and no
 * ink rescues either shade, so the surface moves to darkOrange 700/800 where white
 * clears at 6.11. Only the BUTTON surface: `background.brand`, `border.brand` and
 * `text.brand` stay on #F84416, so the brand colour itself is unchanged everywhere else.
 *
 * Declared after readableButton, which is why this is a function call rather than a
 * literal — the rule lives in one place for the default and the accents alike.
 */
const brandButton = {
  ...readableButton(darkOrange),
  radius: radius.button.default,
};

export const lightTheme: ThemeSemantic = {
  background: {
    primary: '#ffffff',
    secondary: greyNeutral[100],
    tertiary: greyNeutral[50],
    brand: brandMain,
    inverse: greyNeutral[900],
  },
  text: {
    primary: greyNeutral[900],
    secondary: greyNeutral[600],
    tertiary: greyNeutral[500],
    disabled: greyNeutral[400],
    onBrand: '#ffffff',
    onBrandSecondary: 'rgba(255,255,255,0.8)',
    onInverse: greyNeutral[50],
    brand: brandMain,
    link: darkOrange[600],
  },
  border: {
    primary: greyNeutral[200],
    secondary: greyNeutral[300],
    strong: greyNeutral[400],
    brand: brandMain,
    focus: brandMain,
  },
  status: {
    danger: red[500],
    dangerBg: red[50],
    warning: yellow[500],
    warningBg: yellow[50],
    success: green[500],
    successBg: green[50],
  },
  button: {
    brand: brandButton,
    secondary: {
      bg: '#ffffff',
      bgHover: greyNeutral[100],
      fg: greyNeutral[900],
      border: greyNeutral[200],
      radius: radius.button.default,
    },
    ghost: {
      bg: 'transparent',
      bgHover: greyNeutral[100],
      fg: greyNeutral[600],
    },
  },
  input: {
    bg: '#ffffff',
    border: greyNeutral[200],
    borderHover: greyNeutral[300],
    borderFocus: brandMain,
    borderError: red[500],
    placeholder: greyNeutral[500],
    radius: radius.default,
  },
  card: {
    bg: '#ffffff',
    border: greyNeutral[200],
    radius: radius.card.default,
  },
  focus: brandMain,
};

/** Neutral dark (Koala Dark). */
export const darkTheme: ThemeSemantic = {
  background: {
    primary: greyNeutral[900],
    secondary: greyNeutral[800],
    tertiary: greyNeutral[950],
    brand: brandMain,
    inverse: greyNeutral[50],
  },
  text: {
    primary: greyNeutral[50],
    secondary: greyNeutral[400],
    tertiary: greyNeutral[500],
    disabled: greyNeutral[600],
    onBrand: '#ffffff',
    onBrandSecondary: 'rgba(255,255,255,0.8)',
    onInverse: greyNeutral[900],
    brand: darkOrange[400],
    link: darkOrange[400],
  },
  border: {
    primary: greyNeutral[700],
    secondary: greyNeutral[600],
    strong: greyNeutral[500],
    brand: brandMain,
    focus: brandMain,
  },
  status: {
    danger: red[400],
    dangerBg: red[950],
    warning: yellow[400],
    warningBg: yellow[950],
    success: green[400],
    successBg: green[950],
  },
  button: {
    brand: brandButton,
    secondary: {
      bg: greyNeutral[800],
      bgHover: greyNeutral[700],
      fg: greyNeutral[50],
      border: greyNeutral[700],
      radius: radius.button.default,
    },
    ghost: {
      bg: 'transparent',
      bgHover: greyNeutral[800],
      fg: greyNeutral[400],
    },
  },
  input: {
    bg: greyNeutral[800],
    border: greyNeutral[700],
    borderHover: greyNeutral[600],
    borderFocus: brandMain,
    borderError: red[400],
    placeholder: greyNeutral[500],
    radius: radius.default,
  },
  card: {
    bg: greyNeutral[800],
    border: greyNeutral[700],
    radius: radius.card.default,
  },
  focus: brandMain,
};

/** Warm paper surfaces (Koala Cream). */
export const creamTheme: ThemeSemantic = {
  background: {
    primary: cream[50],
    secondary: cream[100],
    tertiary: '#faf9f7',
    brand: brandMain,
    inverse: cream[900],
  },
  text: {
    primary: cream[900],
    secondary: cream[600],
    tertiary: cream[500],
    disabled: cream[400],
    onBrand: '#ffffff',
    onBrandSecondary: 'rgba(255,255,255,0.8)',
    onInverse: cream[50],
    brand: brandMain,
    link: darkOrange[600],
  },
  border: {
    primary: cream[200],
    secondary: cream[300],
    strong: cream[400],
    brand: brandMain,
    focus: brandMain,
  },
  status: {
    danger: red[500],
    dangerBg: red[50],
    warning: yellow[500],
    warningBg: yellow[50],
    success: green[500],
    successBg: green[50],
  },
  button: {
    brand: brandButton,
    secondary: {
      bg: cream[50],
      bgHover: cream[100],
      fg: cream[900],
      border: cream[200],
      radius: radius.button.default,
    },
    ghost: {
      bg: 'transparent',
      bgHover: cream[100],
      fg: cream[600],
    },
  },
  input: {
    bg: '#ffffff',
    border: cream[200],
    borderHover: cream[300],
    borderFocus: brandMain,
    borderError: red[500],
    placeholder: cream[500],
    radius: radius.default,
  },
  card: {
    bg: '#ffffff',
    border: cream[200],
    radius: radius.card.default,
  },
  focus: brandMain,
};

/** Dark + blue tones (Koala Moonlight). */
export const moonlightTheme: ThemeSemantic = {
  background: {
    primary: slate[950],
    secondary: slate[900],
    tertiary: '#07070c',
    brand: brandMain,
    inverse: slate[50],
  },
  text: {
    primary: slate[50],
    secondary: slate[400],
    tertiary: slate[500],
    disabled: slate[600],
    onBrand: '#ffffff',
    onBrandSecondary: 'rgba(255,255,255,0.8)',
    onInverse: slate[950],
    brand: darkOrange[400],
    link: darkBlue[400],
  },
  border: {
    primary: slate[800],
    secondary: slate[700],
    strong: slate[600],
    brand: brandMain,
    focus: darkBlue[400],
  },
  status: {
    danger: red[400],
    dangerBg: red[950],
    warning: yellow[400],
    warningBg: yellow[950],
    success: green[400],
    successBg: green[950],
  },
  button: {
    brand: brandButton,
    secondary: {
      bg: slate[900],
      bgHover: slate[800],
      fg: slate[50],
      border: slate[700],
      radius: radius.button.default,
    },
    ghost: {
      bg: 'transparent',
      bgHover: slate[800],
      fg: slate[400],
    },
  },
  input: {
    bg: slate[900],
    border: slate[700],
    borderHover: slate[600],
    borderFocus: darkBlue[400],
    borderError: red[400],
    placeholder: slate[500],
    radius: radius.default,
  },
  card: {
    bg: slate[900],
    border: slate[800],
    radius: radius.card.default,
  },
  focus: darkBlue[400],
};

export const themes: Record<ThemeName, ThemeSemantic> = {
  light: lightTheme,
  dark: darkTheme,
  cream: creamTheme,
  moonlight: moonlightTheme,
};

/** Accent (brand color) variants — Figma Color page palettes. `default` = Dark Orange. */
export type AccentName = 'default' | 'darkblue' | 'purple' | 'blue' | 'green' | 'softgreen';

export const ACCENT_NAMES: AccentName[] = ['default', 'darkblue', 'purple', 'blue', 'green', 'softgreen'];

export const ACCENT_LABELS: Record<AccentName, string> = {
  default: 'Orange',
  darkblue: 'Dark Blue',
  purple: 'Purple',
  blue: 'Blue',
  green: 'Green',
  softgreen: 'Soft Green',
};

type AccentScale = { 400: string; 500: string; 600: string };

export const ACCENT_SCALES: Record<Exclude<AccentName, 'default'>, AccentScale> = {
  darkblue: darkBlue,
  purple,
  blue,
  green,
  softgreen: softGreen,
};

/** Swatch color per accent, for pickers. */
export const ACCENT_SWATCHES: Record<AccentName, string> = {
  default: brandMain,
  darkblue: darkBlue[500],
  purple: purple[500],
  blue: blue[500],
  green: green[500],
  softgreen: softGreen[500],
};


/**
 * The accent-driven CSS variables, per accent, for the pre-hydration script in
 * `_document`. Without it a saved accent renders orange for one frame on every reload,
 * because the provider only applies it after React hydrates — the same flash the
 * `data-theme` line already prevents for themes.
 *
 * Derived here rather than written out in `_document`, so the colours have one source.
 *
 * The button triple is included: preloading the background without the foreground that
 * readableButton pairs with it flashed a white label on a shade chosen for dark ink.
 *
 * ponytail: ceiling = the remaining accent-derived value, the brand text tint, still
 * settles on hydration. It is small text on the page background rather than a filled
 * control, so it does not read as a flash. Covering it needs the per-theme light/dark
 * branch inlined into a string, and two copies of that is how they drift.
 */
export function accentPreloadVars(accent: AccentName): Record<string, string> {
  if (accent === 'default') return {};
  const scale = ACCENT_SCALES[accent];
  const main = scale[500];
  const button = readableButton(scale);
  return {
    '--koala-bg-brand': main,
    '--koala-border-brand': main,
    '--koala-border-focus': main,
    '--koala-input-border-focus': main,
    '--koala-focus': main,
    '--koala-brand': main,
    '--koala-accent': main,
    '--koala-btn-brand-bg': button.bg,
    '--koala-btn-brand-bg-hover': button.bgHover,
    '--koala-btn-brand-fg': button.fg,
    '--koala-brand-hover': button.bgHover,
  };
}

/** Re-point every brand-derived surface of a theme at the chosen accent scale. */
export function applyAccent(t: ThemeSemantic, accent: AccentName, themeName: ThemeName): ThemeSemantic {
  if (accent === 'default') return t;
  const scale = ACCENT_SCALES[accent];
  const isDark = themeName === 'dark' || themeName === 'moonlight';
  const main = scale[500];
  return {
    ...t,
    background: { ...t.background, brand: main },
    text: {
      ...t.text,
      brand: isDark ? scale[400] : main,
      link: isDark ? scale[400] : scale[600],
    },
    border: { ...t.border, brand: main, focus: main },
    button: {
      ...t.button,
      brand: { ...t.button.brand, ...readableButton(scale) },
    },
    input: { ...t.input, borderFocus: main },
    focus: main,
  };
}

/** Flatten theme → CSS custom properties (semantic + legacy aliases). */
export function themeToCssVars(t: ThemeSemantic): Record<string, string> {
  return {
    '--koala-bg-primary': t.background.primary,
    '--koala-bg-secondary': t.background.secondary,
    '--koala-bg-tertiary': t.background.tertiary,
    '--koala-bg-brand': t.background.brand,
    '--koala-bg-inverse': t.background.inverse,
    '--koala-text-primary': t.text.primary,
    '--koala-text-secondary': t.text.secondary,
    '--koala-text-tertiary': t.text.tertiary,
    '--koala-text-disabled': t.text.disabled,
    '--koala-text-on-brand': t.text.onBrand,
    '--koala-text-on-brand-secondary': t.text.onBrandSecondary,
    '--koala-text-on-inverse': t.text.onInverse,
    '--koala-text-brand': t.text.brand,
    '--koala-text-link': t.text.link,
    '--koala-border-primary': t.border.primary,
    '--koala-border-secondary': t.border.secondary,
    '--koala-border-strong': t.border.strong,
    '--koala-border-brand': t.border.brand,
    '--koala-border-focus': t.border.focus,
    '--koala-status-danger': t.status.danger,
    '--koala-status-danger-bg': t.status.dangerBg,
    '--koala-status-warning': t.status.warning,
    '--koala-status-warning-bg': t.status.warningBg,
    '--koala-status-success': t.status.success,
    '--koala-status-success-bg': t.status.successBg,
    '--koala-btn-brand-bg': t.button.brand.bg,
    '--koala-btn-brand-bg-hover': t.button.brand.bgHover,
    '--koala-btn-brand-fg': t.button.brand.fg,
    '--koala-btn-secondary-bg': t.button.secondary.bg,
    '--koala-btn-secondary-bg-hover': t.button.secondary.bgHover,
    '--koala-btn-secondary-fg': t.button.secondary.fg,
    '--koala-btn-secondary-border': t.button.secondary.border,
    '--koala-btn-ghost-bg-hover': t.button.ghost.bgHover,
    '--koala-btn-ghost-fg': t.button.ghost.fg,
    '--koala-input-bg': t.input.bg,
    '--koala-input-border': t.input.border,
    '--koala-input-border-hover': t.input.borderHover,
    '--koala-input-border-focus': t.input.borderFocus,
    '--koala-input-border-error': t.input.borderError,
    '--koala-input-placeholder': t.input.placeholder,
    '--koala-card-bg': t.card.bg,
    '--koala-card-border': t.card.border,
    '--koala-focus': t.focus,
    /* Legacy Ranksmile / shell aliases */
    '--color-text-primary': t.text.primary,
    '--color-text-secondary': t.text.secondary,
    '--color-text-tertiary': t.text.tertiary,
    '--color-surface-base': t.background.primary,
    '--color-surface-secondary': t.background.secondary,
    '--color-surface-tertiary': t.background.tertiary,
    '--color-surface-strong': t.card.bg,
    '--color-surface-raised': t.background.brand,
    '--color-border-strong': t.border.strong,
    '--color-border-primary': t.border.primary,
    '--koala-brand': t.background.brand,
    '--koala-brand-hover': t.button.brand.bgHover,
    '--zone-editor-bg': t.background.primary,
    '--zone-content-bg': t.background.secondary,
    '--koala-accent': t.background.brand,
    '--koala-shell-bg': t.background.primary,
    '--shadow-focus': `0 0 0 2px ${t.background.primary}, 0 0 0 4px ${t.focus}`,
  };
}

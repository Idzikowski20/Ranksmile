import type { ThemeName } from '../../components/koala/tokens/themes';

export const THEMES: ThemeName[] = ['light', 'dark', 'cream', 'moonlight'];

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export type MatrixCase = {
  theme: ThemeName;
  viewport: ViewportName;
  /** Snapshot name segment, e.g. desktop-light */
  name: string;
};

/** Build theme × viewport cases. Default v1 auth shipping set. */
export function authSignInCases(): MatrixCase[] {
  const out: MatrixCase[] = [];
  for (const theme of THEMES) {
    out.push({ theme, viewport: 'desktop', name: `desktop-${theme}` });
  }
  out.push({ theme: 'light', viewport: 'tablet', name: 'tablet-light' });
  out.push({ theme: 'light', viewport: 'mobile', name: 'mobile-light' });
  return out;
}

export function galleryCases(): MatrixCase[] {
  return [
    { theme: 'light', viewport: 'desktop', name: 'desktop-light' },
    { theme: 'dark', viewport: 'desktop', name: 'desktop-dark' },
  ];
}

export async function applyTheme(page: { evaluate: (fn: (t: string) => void, t: string) => Promise<unknown> }, theme: ThemeName) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
}

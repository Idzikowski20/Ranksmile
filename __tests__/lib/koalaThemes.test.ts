import fs from 'fs';
import path from 'path';
import {
  THEME_NAMES,
  themes,
  themeToCssVars,
} from '../../components/koala/tokens/themes';

describe('koala themes', () => {
  it('exposes the four Koala theme modes', () => {
    expect(THEME_NAMES).toEqual(['light', 'dark', 'cream', 'moonlight']);
    expect(Object.keys(themes).sort()).toEqual([...THEME_NAMES].sort());
  });

  it('maps each theme to CSS variables used by semantic tokens', () => {
    const vars = themeToCssVars(themes.moonlight);
    expect(vars['--koala-bg-primary']).toBe(themes.moonlight.background.primary);
    expect(vars['--koala-text-primary']).toBe(themes.moonlight.text.primary);
    expect(vars['--color-surface-base']).toBe(themes.moonlight.background.primary);
  });
});

/**
 * `background.inverse` flips with the theme — dark in light/cream, near-white in
 * dark/moonlight — so anything painted on it needs a foreground that flips too.
 * `--koala-text-on-inverse` was used by components but defined nowhere, leaving them on a
 * literal `#fff` fallback: white on `#fafafa` in dark mode.
 */
describe('the inverse surface has a readable foreground in every theme', () => {
  const luminance = (hex: string): number => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  it.each(THEME_NAMES)('%s defines one and contrasts it against the fill', (name) => {
    const { background, text } = themes[name];

    expect(text.onInverse).toMatch(/^#[0-9a-f]{3,8}$/i);
    // Not a contrast-ratio check — just the failure that shipped: the two being the
    // same end of the scale.
    expect(Math.abs(luminance(text.onInverse) - luminance(background.inverse)))
      .toBeGreaterThan(0.5);
  });

  it('publishes it as a CSS variable', () => {
    expect(themeToCssVars(themes.dark)['--koala-text-on-inverse'])
      .toBe(themes.dark.text.onInverse);
  });

  /**
   * globals.css carries the same values as static defaults, and they apply until
   * KoalaThemeProvider runs. A drift between the two is a flash of the wrong colour on
   * every load — I introduced exactly that drift writing this fix.
   */
  it('matches the static defaults in globals.css', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'styles', 'globals.css'), 'utf8');
    const pairs = [...css.matchAll(/--koala-bg-inverse:\s*(#[0-9a-f]+);\s*\n\s*--koala-text-on-inverse:\s*(#[0-9a-f]+);/gi)]
      .map(([, bg, fg]) => `${bg.toLowerCase()}|${fg.toLowerCase()}`);
    const fromThemes = THEME_NAMES
      .map((n) => `${themes[n].background.inverse.toLowerCase()}|${themes[n].text.onInverse.toLowerCase()}`);

    expect(pairs.sort()).toEqual(fromThemes.sort());
  });
});

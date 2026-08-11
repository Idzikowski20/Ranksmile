import {
  ACCENT_NAMES,
  applyAccent,
  darkTheme,
  lightTheme,
  themeToCssVars,
} from '../../components/koala/tokens/themes';
import { darkBlue, purple } from '../../components/koala/tokens/colors';

describe('applyAccent', () => {
  it('returns theme unchanged for default accent', () => {
    expect(applyAccent(lightTheme, 'default', 'light')).toBe(lightTheme);
  });

  it('re-points brand surfaces at accent scale (light)', () => {
    const t = applyAccent(lightTheme, 'darkblue', 'light');
    expect(t.background.brand).toBe(darkBlue[500]);
    expect(t.button.brand.bg).toBe(darkBlue[500]);
    expect(t.button.brand.bgHover).toBe(darkBlue[600]);
    expect(t.text.brand).toBe(darkBlue[500]);
    expect(t.text.link).toBe(darkBlue[600]);
    expect(t.border.focus).toBe(darkBlue[500]);
    expect(t.input.borderFocus).toBe(darkBlue[500]);
    expect(t.focus).toBe(darkBlue[500]);
  });

  it('uses 400 shade for text on dark themes', () => {
    const t = applyAccent(darkTheme, 'purple', 'dark');
    expect(t.text.brand).toBe(purple[400]);
    expect(t.text.link).toBe(purple[400]);
    expect(t.background.brand).toBe(purple[500]);
  });

  it('does not touch non-brand surfaces', () => {
    const t = applyAccent(lightTheme, 'green', 'light');
    expect(t.background.primary).toBe(lightTheme.background.primary);
    expect(t.text.primary).toBe(lightTheme.text.primary);
    expect(t.status).toEqual(lightTheme.status);
  });

  it('every accent flows into CSS vars', () => {
    for (const name of ACCENT_NAMES) {
      const vars = themeToCssVars(applyAccent(lightTheme, name, 'light'));
      expect(vars['--koala-brand']).toBeTruthy();
      expect(vars['--koala-btn-brand-bg']).toBeTruthy();
    }
  });

  /**
   * The button background is no longer required to equal the brand colour: at 500/600
   * white on purple reached 4.23 and dark ink on blue dropped to 3.74 on hover, so the
   * shade moves down until the label clears AA. That readability is the contract now.
   */
  it('gives every accent a primary button that clears AA on rest and hover', () => {
    const luminance = (hex: string) => {
      const v = hex.replace('#', '');
      const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
      const channel = (i: number) => {
        const c = parseInt(full.slice(i * 2, i * 2 + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };

    for (const name of ACCENT_NAMES) {
      if (name === 'default') continue; // the brand orange is not chosen by applyAccent
      const { bg, bgHover, fg } = applyAccent(lightTheme, name, 'light').button.brand;
      expect(Math.min(ratio(fg, bg), ratio(fg, bgHover))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

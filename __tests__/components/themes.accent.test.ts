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
      expect(vars['--koala-btn-brand-bg']).toBe(vars['--koala-brand']);
    }
  });
});

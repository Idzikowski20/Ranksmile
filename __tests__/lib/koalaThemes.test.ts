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

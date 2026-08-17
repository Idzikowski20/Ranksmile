import React from 'react';
import {
  ACCENT_LABELS,
  ACCENT_NAMES,
  ACCENT_SWATCHES,
  THEME_LABELS,
  THEME_NAMES,
  themes,
  type ThemeName,
} from '../tokens/themes';
import { useKoalaTheme } from './KoalaThemeProvider';
import { Icon } from '../icons/Icon';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/effects';

/**
 * Both pickers are the same control with a different swatch, so the style lives once.
 * It was duplicated verbatim, which meant every padding or active-border tweak had to be
 * made twice and stayed correct only until someone forgot.
 */
function pickerButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    borderRadius: radius.sm,
    border: `1px solid ${active ? 'var(--koala-brand)' : 'var(--koala-border-primary)'}`,
    background: active
      ? 'color-mix(in srgb, var(--koala-brand) 12%, var(--koala-bg-primary))'
      : 'var(--koala-bg-primary)',
    color: 'var(--koala-text-primary)',
    font: 'inherit',
    fontSize: 'var(--font-size-sm)',
    fontWeight: 500,
    cursor: 'var(--koala-cursor-pointing)',
  };
}

/** Compact theme picker — Light / Dark / Cream / Moonlight. */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { themeName, setTheme } = useKoalaTheme();

  return (
    <div
      className={className}
      role="group"
      aria-label="Theme"
      style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {THEME_NAMES.map((name) => {
        const active = name === themeName;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(name)}
            style={pickerButtonStyle(active)}
          >
            <ThemeSwatch name={name} />
            {THEME_LABELS[name]}
          </button>
        );
      })}
    </div>
  );
}

function ThemeSwatch({ name }: { name: ThemeName }) {
  const t = themes[name];
  const a = t.background.primary;
  const b = t.border.primary;
  return (
    <span
      aria-hidden="true"
      style={{
        width: spacing.xl,
        height: spacing.xl,
        borderRadius: radius.sm,
        background: `linear-gradient(135deg, ${a} 50%, ${b} 50%)`,
        border: '1px solid var(--koala-border-primary)',
        flexShrink: 0,
      }}
    />
  );
}

/** Accent color picker — Orange (default) / Dark Blue / Purple / Blue / Green / Soft Green. */
export function AccentSwitcher({ className }: { className?: string }) {
  const { accentName, setAccent } = useKoalaTheme();

  return (
    <div
      className={className}
      role="group"
      aria-label="Accent color"
      style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}
    >
      {ACCENT_NAMES.map((name) => {
        const active = name === accentName;
        return (
          <button
            key={name}
            type="button"
            aria-pressed={active}
            onClick={() => setAccent(name)}
            style={pickerButtonStyle(active)}
          >
            <span
              aria-hidden="true"
              style={{
                width: spacing.xl,
                height: spacing.xl,
                borderRadius: '50%',
                background: ACCENT_SWATCHES[name],
                border: '1px solid var(--koala-border-primary)',
                flexShrink: 0,
              }}
            />
            {ACCENT_LABELS[name]}
          </button>
        );
      })}
    </div>
  );
}

/** Icon button that cycles themes (header utility). */
export function ThemeCycleButton({ className }: { className?: string }) {
  const { themeName, cycleTheme } = useKoalaTheme();
  return (
    <button
      type="button"
      className={className}
      aria-label={`Theme: ${THEME_LABELS[themeName]}. Click to change.`}
      title={THEME_LABELS[themeName]}
      onClick={cycleTheme}
    >
      <Icon
        name={themeName === 'light' || themeName === 'cream' ? 'Moon' : 'Sun'}
        size={20}
        weight="bold"
      />
    </button>
  );
}

export default ThemeSwitcher;

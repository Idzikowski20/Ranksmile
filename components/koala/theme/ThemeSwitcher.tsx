import React from 'react';
import { THEME_LABELS, THEME_NAMES, themes, type ThemeName } from '../tokens/themes';
import { useKoalaTheme } from './KoalaThemeProvider';
import { Icon } from '../icons/Icon';
import { spacing } from '../tokens/spacing';
import { radius } from '../tokens/effects';

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
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing.sm,
              padding: `${spacing.sm} ${spacing.md}`,
              borderRadius: radius.sm,
              border: `1px solid ${active ? 'var(--koala-brand)' : 'var(--koala-border-primary)'}`,
              background: active ? 'color-mix(in srgb, var(--koala-brand) 12%, var(--koala-bg-primary))' : 'var(--koala-bg-primary)',
              color: 'var(--koala-text-primary)',
              font: 'inherit',
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              cursor: 'var(--koala-cursor-pointing)',
            }}
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
